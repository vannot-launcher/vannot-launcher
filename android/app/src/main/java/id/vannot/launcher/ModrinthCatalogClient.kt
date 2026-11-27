package id.vannot.launcher

import org.json.JSONObject

internal data class ModrinthProject(
    val title: String,
    val author: String,
    val description: String,
    val downloads: Long,
)

internal class ModrinthCatalogClient {
    fun searchMods(query: String): List<ModrinthProject> {
        val projects = RustCore.nativeSearchMods(query)
        val results = org.json.JSONArray(projects)
        return List(results.length()) { index -> results.getJSONObject(index).toProject() }
    }

    private fun JSONObject.toProject(): ModrinthProject = ModrinthProject(
        title = getString("title"),
        author = getString("author"),
        description = getString("description"),
        downloads = getLong("downloads"),
    )
}
