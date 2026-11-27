import { ArrowUpRight, Check, ExternalLink, FileCheck2, MonitorDown, ShieldAlert } from 'lucide-react';
import './download.css';

const sourceUrl = 'https://github.com/vannot-launcher/vannot-launcher';

export default function DownloadPortal() {
  return (
    <div className="download-site">
      <header className="download-header">
        <a className="download-brand" href="#top" aria-label="Vannot Launcher home">
          <img src="/vannot-logo.svg" alt="" />
          <span>VANNOT<span className="brand-dot">.</span></span>
        </a>
        <nav aria-label="Site navigation">
          <a href="#features">Fitur</a>
          <a href="#status">Status rilis</a>
          <a href={sourceUrl} target="_blank" rel="noreferrer">Source <ExternalLink size={14} /></a>
        </nav>
        <a className="header-download" href={sourceUrl} target="_blank" rel="noreferrer">
          <ArrowUpRight size={16} /> Source
        </a>
      </header>

      <main id="top">
        <section className="download-hero" aria-labelledby="hero-title">
          <video className="download-hero__video" src="/vannot-hero.mp4" autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />
          <div className="hero-copy">
            <div className="release-label"><span /> MINECRAFT JAVA EDITION <i /> OPEN SOURCE</div>
            <h1 id="hero-title">Vannot<br /><em>Launcher</em></h1>
            <p className="hero-description">Vannot dirancang untuk Minecraft Java dengan dashboard baru dan runtime native XMCL.</p>
            <div className="hero-actions">
              <a className="primary-download" href={sourceUrl} target="_blank" rel="noreferrer">
                <FileCheck2 size={20} />
                <span><strong>Lihat source code</strong><small>BUILD VANNOT BELUM DIRILIS</small></span>
                <ArrowUpRight className="download-arrow" size={18} />
              </a>
              <a className="release-link" href="#status">
                Status pengembangan <ArrowUpRight size={15} />
              </a>
            </div>
            <div className="hero-footnote"><ShieldAlert size={15} /> Installer Vannot belum tersedia untuk diunduh.</div>
          </div>

          <div className="hero-mark" aria-label="Vannot Launcher logo">
            <div className="mark-orbit mark-orbit--one" />
            <div className="mark-orbit mark-orbit--two" />
            <img src="/vannot-logo.svg" alt="Vannot Launcher logo" />
            <span className="mark-caption">MINECRAFT<br />JAVA EDITION</span>
            <span className="mark-coordinate">VANNOT / JAVA</span>
          </div>
          <div className="hero-index">01 <span>/</span> VANNOT</div>
        </section>

        <section className="release-bar" id="status" aria-label="Release status">
          <div><span className="bar-label">VERSI</span><strong>Dalam pengembangan</strong></div>
          <div><span className="bar-label">PLATFORM</span><strong>Windows · Android · Linux</strong></div>
          <div><span className="bar-label">STATUS</span><strong className="status-ready"><Check size={15} /> Rencana: XMCL</strong></div>
          <div><span className="bar-label">UNDUHAN</span><strong>Belum tersedia</strong></div>
        </section>

        <section className="feature-section" id="features">
          <div className="section-intro">
            <span className="section-kicker">DIBUAT UNTUK MINECRAFT JAVA</span>
            <h2>Satu tempat.<br /><em>Banyak kemungkinan.</em></h2>
          </div>
          <div className="feature-list">
            <article className="feature-row">
              <span className="feature-number">01</span><MonitorDown size={21} />
              <div><h3>Runtime Minecraft Java native</h3><p>Build Windows direncanakan menggunakan source XMCL yang dipatok; dashboard Vannot tidak mengganti atau meniru proses runtime game.</p></div>
            </article>
            <article className="feature-row">
              <span className="feature-number">02</span><FileCheck2 size={21} />
              <div><h3>Proyek open source</h3><p>Source dan workflow build tersedia untuk ditinjau. Installer Vannot baru akan ditautkan setelah build rebrand diverifikasi dan dirilis.</p></div>
            </article>
            <article className="feature-row">
              <span className="feature-number">03</span><ShieldAlert size={21} />
              <div><h3>Jangan gunakan rilis lama sebagai Vannot</h3><p>Rilis beta sebelumnya memakai branding Moon Launcher dan bukan installer Vannot.</p></div>
            </article>
          </div>
        </section>

        <section className="requirements">
          <div><span className="section-kicker">STATUS PENGEMBANGAN</span><h2>Belum ada build Vannot publik</h2></div>
          <dl>
            <div><dt>Source</dt><dd>XMCL native runtime dan dashboard Vannot</dd></div>
            <div><dt>Rilis sebelumnya</dt><dd>Moon Launcher beta · bukan build Vannot</dd></div>
            <div><dt>Unduhan</dt><dd>Menunggu build dan verifikasi rilis</dd></div>
          </dl>
        </section>
      </main>

      <footer className="download-footer">
        <a className="download-brand footer-brand" href="#top"><img src="/vannot-logo.svg" alt="" /><span>VANNOT<span className="brand-dot">.</span></span></a>
        <span>Minecraft Java Edition · Vannot Launcher</span>
        <a href={sourceUrl} target="_blank" rel="noreferrer">GitHub <ExternalLink size={13} /></a>
      </footer>
    </div>
  );
}
