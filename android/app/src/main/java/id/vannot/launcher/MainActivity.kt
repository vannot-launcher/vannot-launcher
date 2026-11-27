package id.vannot.launcher

import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private enum class Section(val label: String) {
        HOME("Home"),
        DISCOVER("Discover"),
        LIBRARY("Library"),
        SETTINGS("Settings"),
    }

    private val forest = Color.rgb(14, 21, 17)
    private val panel = Color.rgb(23, 33, 27)
    private val panelRaised = Color.rgb(31, 44, 35)
    private val lime = Color.rgb(185, 242, 122)
    private val amber = Color.rgb(228, 184, 93)
    private val ivory = Color.rgb(238, 243, 232)
    private val muted = Color.rgb(161, 176, 157)

    private lateinit var pageContent: LinearLayout
    private lateinit var navigationBar: LinearLayout
    private var selectedSection = Section.HOME

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = forest
        window.navigationBarColor = forest
        window.decorView.setBackgroundColor(forest)
        selectedSection = savedInstanceState
            ?.getString(STATE_SECTION)
            ?.let { name -> Section.entries.firstOrNull { it.name == name } }
            ?: Section.HOME
        setContentView(createAppShell())
        renderSection()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        outState.putString(STATE_SECTION, selectedSection.name)
        super.onSaveInstanceState(outState)
    }

    private fun createAppShell(): View {
        val shell = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(forest)
            setPadding(dp(18), dp(12), dp(18), dp(8))
        }

        shell.addView(createHeader(), LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(58),
        ))

        val scroll = ScrollView(this).apply {
            isFillViewport = true
            clipToPadding = false
            setPadding(0, dp(8), 0, dp(18))
        }
        pageContent = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        scroll.addView(pageContent)
        shell.addView(scroll, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            0,
            1f,
        ))
        shell.addView(createNavigation(), LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(58),
        ))
        return shell
    }

    private fun createHeader(): View {
        val header = LinearLayout(this).apply {
            gravity = Gravity.CENTER_VERTICAL
            orientation = LinearLayout.HORIZONTAL
        }
        val mark = label("V", 19f, forest, bold = true).apply {
            gravity = Gravity.CENTER
            background = rounded(lime, 13)
        }
        header.addView(mark, LinearLayout.LayoutParams(dp(42), dp(42)))

        val identity = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(11), 0, 0, 0)
        }
        identity.addView(label("VANNOT", 14f, ivory, bold = true))
        identity.addView(label("ANDROID FIELD BUILD", 9f, muted, bold = true))
        header.addView(identity, LinearLayout.LayoutParams(0, -2, 1f))

        val account = label("ACCOUNT  ·  OFF", 9f, muted, bold = true).apply {
            gravity = Gravity.CENTER
            setPadding(dp(11), dp(9), dp(11), dp(9))
            background = rounded(panelRaised, 20)
            contentDescription = "Account sign-in not connected"
        }
        header.addView(account)
        return header
    }

    private fun createNavigation(): View {
        navigationBar = LinearLayout(this).apply {
            gravity = Gravity.CENTER
            orientation = LinearLayout.HORIZONTAL
            background = rounded(panel, 15)
            setPadding(dp(4), dp(4), dp(4), dp(4))
        }
        refreshNavigation()
        return navigationBar
    }

    private fun refreshNavigation() {
        navigationBar.removeAllViews()
        Section.entries.forEach { section ->
            val item = TextView(this).apply {
                text = section.label
                textSize = 10f
                gravity = Gravity.CENTER
                typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
                setTextColor(if (section == selectedSection) lime else muted)
                setPadding(dp(3), dp(13), dp(3), dp(13))
                contentDescription = section.label
                setOnClickListener {
                    if (selectedSection != section) {
                        selectedSection = section
                        renderSection()
                    }
                }
            }
            navigationBar.addView(item, LinearLayout.LayoutParams(0, -1, 1f))
        }
    }

    private fun renderSection() {
        refreshNavigation()
        pageContent.removeAllViews()
        when (selectedSection) {
            Section.HOME -> renderHome()
            Section.DISCOVER -> renderDiscover()
            Section.LIBRARY -> renderLibrary()
            Section.SETTINGS -> renderSettings()
        }
    }

    private fun renderHome() {
        val hero = card(panelRaised).apply {
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(Color.rgb(38, 58, 43), Color.rgb(20, 30, 24)),
            ).apply {
                cornerRadius = dp(20).toFloat()
                setStroke(dp(1), Color.rgb(63, 83, 60))
            }
        }
        hero.addView(label("VANNOT  /  FIELD NOTE 001", 9f, amber, bold = true))
        hero.addView(label("Your next world\nstarts here.", 30f, ivory, bold = true).apply {
            setPadding(0, dp(15), 0, dp(9))
        })
        hero.addView(label(
            "An original Android launcher foundation, built by the Vannot team.",
            13f,
            muted,
        ))
        hero.addView(statusBadge("MINECRAFT RUNTIME NOT CONNECTED", amber).apply {
            setPadding(0, dp(18), 0, 0)
        })
        pageContent.addView(hero, cardLayout())

        pageContent.addView(sectionHeading("BUILD STATUS", "01 / 03"))
        val status = card()
        addStatusRow(status, "01", "Native Kotlin app", "READY", lime)
        addDivider(status)
        addStatusRow(status, "02", "Android Java runtime", "IN DEVELOPMENT", amber)
        addDivider(status)
        addStatusRow(status, "03", "Minecraft install and launch", "NOT AVAILABLE", muted)
        pageContent.addView(status, cardLayout())

        pageContent.addView(sectionHeading("QUICK ACCESS", "VANNOT"))
        val quickAccess = card()
        quickAccess.addView(label(
            "The launcher shell is working. Game downloads, accounts, loaders, and mod installs are not connected yet.",
            13f,
            muted,
        ))
        val unavailable = Button(this).apply {
            text = "GAME RUNTIME NOT AVAILABLE"
            isEnabled = false
            textSize = 11f
            setTextColor(muted)
            backgroundTintList = ColorStateList.valueOf(panelRaised)
        }
        quickAccess.addView(unavailable, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(48),
        ).apply {
            topMargin = dp(16)
        })
        pageContent.addView(quickAccess, cardLayout())
    }

    private fun renderDiscover() {
        pageContent.addView(sectionHeading("DISCOVER", "CONTENT ATLAS"))
        val catalog = card(panelRaised)
        catalog.addView(label("A new catalog is being built.", 22f, ivory, bold = true))
        catalog.addView(label(
            "This independent app does not bundle another launcher or pretend to download Minecraft. Mod and modpack browsing will be added after the game runtime and safe installation flow are ready.",
            13f,
            muted,
        ).apply {
            setPadding(0, dp(10), 0, 0)
        })
        catalog.addView(statusBadge("CATALOG NOT CONNECTED", amber).apply {
            setPadding(0, dp(16), 0, 0)
        })
        pageContent.addView(catalog, cardLayout())
        pageContent.addView(sectionHeading("PLANNED", "AFTER RUNTIME"))
        pageContent.addView(infoCard("Game versions", "Install verified Minecraft Java versions."))
        pageContent.addView(infoCard("Loaders", "Fabric, Forge, and NeoForge after device compatibility testing."))
        pageContent.addView(infoCard("Mods and packs", "Browse and install compatible community projects."))
    }

    private fun renderLibrary() {
        pageContent.addView(sectionHeading("LIBRARY", "LOCAL WORLDS"))
        val empty = card(panelRaised)
        empty.addView(label("No game instances yet", 22f, ivory, bold = true))
        empty.addView(label(
            "Instances will appear here after the Minecraft runtime and version installer are implemented.",
            13f,
            muted,
        ).apply {
            setPadding(0, dp(10), 0, 0)
        })
        pageContent.addView(empty, cardLayout())
    }

    private fun renderSettings() {
        pageContent.addView(sectionHeading("SETTINGS", "APP FOUNDATION"))
        val details = card()
        addStatusRow(details, "APP", "Vannot Android", "0.1.0 DEV", lime)
        addDivider(details)
        addStatusRow(details, "JAVA", "Android game runtime", "NOT INSTALLED", amber)
        addDivider(details)
        addStatusRow(details, "ACCOUNT", "Microsoft authentication", "NOT CONNECTED", muted)
        pageContent.addView(details, cardLayout())

        val note = card(panelRaised)
        note.addView(label("Built independently", 18f, ivory, bold = true))
        note.addView(label(
            "This is Vannot's own native Kotlin app shell. It does not use another launcher's APK, source tree, or branding.",
            13f,
            muted,
        ).apply {
            setPadding(0, dp(9), 0, 0)
        })
        pageContent.addView(note, cardLayout())
    }

    private fun infoCard(title: String, description: String): View {
        return card().apply {
            addView(label(title, 16f, ivory, bold = true))
            addView(label(description, 12f, muted).apply {
                setPadding(0, dp(6), 0, 0)
            })
        }
    }

    private fun sectionHeading(title: String, meta: String): View {
        val row = LinearLayout(this).apply {
            gravity = Gravity.CENTER_VERTICAL
            orientation = LinearLayout.HORIZONTAL
            setPadding(dp(3), dp(14), dp(3), dp(10))
        }
        row.addView(label(title, 10f, ivory, bold = true), LinearLayout.LayoutParams(0, -2, 1f))
        row.addView(label(meta, 9f, muted, bold = true))
        return row
    }

    private fun card(color: Int = panel): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(17), dp(17), dp(17), dp(17))
            background = rounded(color, 16).apply {
                setStroke(dp(1), Color.rgb(42, 57, 45))
            }
        }
    }

    private fun addStatusRow(parent: LinearLayout, index: String, title: String, state: String, stateColor: Int) {
        val row = LinearLayout(this).apply {
            gravity = Gravity.CENTER_VERTICAL
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, dp(9), 0, dp(9))
        }
        row.addView(label(index, 9f, lime, bold = true), LinearLayout.LayoutParams(dp(32), -2))
        row.addView(label(title, 12f, ivory), LinearLayout.LayoutParams(0, -2, 1f))
        row.addView(label(state, 8f, stateColor, bold = true).apply {
            gravity = Gravity.END
        })
        parent.addView(row)
    }

    private fun addDivider(parent: LinearLayout) {
        parent.addView(View(this).apply {
            setBackgroundColor(Color.rgb(43, 57, 46))
        }, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(1),
        ))
    }

    private fun statusBadge(text: String, textColor: Int): TextView {
        return label(text, 8f, textColor, bold = true).apply {
            setPadding(dp(10), dp(8), dp(10), dp(8))
            background = rounded(Color.rgb(22, 33, 26), 20).apply {
                setStroke(dp(1), Color.rgb(54, 72, 55))
            }
        }
    }

    private fun label(text: String, size: Float, color: Int, bold: Boolean = false): TextView {
        return TextView(this).apply {
            this.text = text
            textSize = size
            setTextColor(color)
            typeface = Typeface.create(
                if (bold) "sans-serif" else "sans-serif",
                if (bold) Typeface.BOLD else Typeface.NORMAL,
            )
            includeFontPadding = true
        }
    }

    private fun rounded(color: Int, radiusDp: Int): GradientDrawable {
        return GradientDrawable().apply {
            setColor(color)
            cornerRadius = dp(radiusDp).toFloat()
        }
    }

    private fun cardLayout(): LinearLayout.LayoutParams {
        return LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply {
            bottomMargin = dp(10)
        }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    companion object {
        private const val STATE_SECTION = "selected_section"
    }
}
