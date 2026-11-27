package id.vannot.launcher

internal object RustCore {
    init {
        System.loadLibrary("vannot_android_core")
    }

    external fun nativeGameVersion(): String

    external fun nativeSearchMods(query: String): String
}
