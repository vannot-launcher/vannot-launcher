use jni::objects::{JObject, JString};
use jni::sys::jstring;
use jni::JNIEnv;
use serde::{Deserialize, Serialize};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::ptr;

const GAME_VERSION: &str = "26.3";
const MODRINTH_USER_AGENT: &str =
    "id.vannot.launcher/0.1.0 (https://github.com/vannot-launcher/vannot-launcher)";

#[derive(Deserialize, Serialize)]
struct ModrinthProject {
    title: String,
    author: String,
    description: String,
    downloads: u64,
}

#[derive(Deserialize)]
struct ModrinthSearchResponse {
    hits: Vec<ModrinthProject>,
}

fn search_url(query: &str) -> String {
    let facets = serde_json::json!([["project_type:mod"], [format!("versions:{GAME_VERSION}")]]);
    let mut url = format!(
        "https://api.modrinth.com/v2/search?facets={}&limit=30&index=relevance",
        urlencoding::encode(&facets.to_string())
    );
    if !query.trim().is_empty() {
        url.push_str("&query=");
        url.push_str(&urlencoding::encode(query.trim()));
    }
    url
}

fn search_modrinth(query: &str) -> Result<String, String> {
    let response = ureq::get(&search_url(query))
        .set("Accept", "application/json")
        .set("User-Agent", MODRINTH_USER_AGENT)
        .call()
        .map_err(|error| error.to_string())?;
    let body = response
        .into_string()
        .map_err(|error| format!("Could not read Modrinth response: {error}"))?;
    let result: ModrinthSearchResponse = serde_json::from_str(&body)
        .map_err(|error| format!("Modrinth returned invalid catalog data: {error}"))?;
    serde_json::to_string(&result.hits)
        .map_err(|error| format!("Could not encode Modrinth results: {error}"))
}

fn throw_exception(env: &mut JNIEnv, class: &str, message: impl Into<String>) -> jstring {
    if let Err(error) = env.throw_new(class, message.into()) {
        eprintln!("Could not raise Java exception from Vannot Rust core: {error}");
    }
    ptr::null_mut()
}

#[no_mangle]
pub extern "system" fn Java_id_vannot_launcher_RustCore_nativeGameVersion(
    mut env: JNIEnv,
    _class: JObject,
) -> jstring {
    match env.new_string(GAME_VERSION) {
        Ok(value) => value.into_raw(),
        Err(error) => throw_exception(
            &mut env,
            "java/lang/IllegalStateException",
            format!("Could not read game version from Rust core: {error}"),
        ),
    }
}

#[no_mangle]
pub extern "system" fn Java_id_vannot_launcher_RustCore_nativeSearchMods(
    mut env: JNIEnv,
    _class: JObject,
    query: JString,
) -> jstring {
    let query: String = match env.get_string(&query) {
        Ok(value) => value.into(),
        Err(error) => {
            return throw_exception(
                &mut env,
                "java/lang/IllegalArgumentException",
                format!("Could not read Modrinth search query: {error}"),
            );
        }
    };

    match catch_unwind(AssertUnwindSafe(|| search_modrinth(&query))) {
        Ok(Ok(response)) => match env.new_string(response) {
            Ok(value) => value.into_raw(),
            Err(error) => throw_exception(
                &mut env,
                "java/lang/IllegalStateException",
                format!("Could not return Modrinth results from Rust core: {error}"),
            ),
        },
        Ok(Err(error)) => throw_exception(&mut env, "java/io/IOException", error),
        Err(_) => throw_exception(
            &mut env,
            "java/io/IOException",
            "Modrinth search failed unexpectedly in the Rust core",
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::{search_url, GAME_VERSION};

    #[test]
    fn modrinth_search_is_locked_to_mods_for_minecraft_263() {
        let url = search_url("Sodium");
        let decoded_facets = urlencoding::decode(
            url.split("facets=")
                .nth(1)
                .unwrap()
                .split('&')
                .next()
                .unwrap(),
        )
        .unwrap();

        assert!(decoded_facets.contains("project_type:mod"));
        assert!(decoded_facets.contains(&format!("versions:{GAME_VERSION}")));
        assert!(url.contains("&query=Sodium"));
        assert!(!url.contains("versions:1.21"));
    }

    #[test]
    fn blank_search_does_not_add_a_query_parameter() {
        let url = search_url("  ");

        assert!(!url.contains("&query="));
        assert!(url.contains(&format!("versions%3A{GAME_VERSION}")));
    }
}
