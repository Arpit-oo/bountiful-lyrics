export const CORE_CSS = `
.bl-stage{position:absolute;inset:0;overflow:hidden;background:#000;color:var(--bl-lyric);font-family:var(--bl-font);--bl-size:calc(clamp(40px,12.5cqmin,168px)*var(--bl-scale,1));container-type:size}
.bl-stage.bl-transparent{background:transparent}
.bl-bg{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.bl-bg>*{position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity .9s ease}
.bl-sky{opacity:1;display:block}
/* Album art as frosted glass: the cover blurred into soft colour, a fine grain and a sheen. */
.bl-backdrop{object-fit:cover;filter:blur(42px) saturate(1.5) brightness(.62);transform:scale(1.25)}
.bl-stage[data-bg="art"] .bl-backdrop[data-ready="1"]{opacity:1}
.bl-bg-glass{background:linear-gradient(160deg,rgba(255,255,255,.08),rgba(255,255,255,0) 38%,rgba(0,0,0,.18)),url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .5 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");mix-blend-mode:soft-light}
.bl-stage[data-bg="art"] .bl-bg-glass{opacity:.55}
/* Cinematic blur: the cover blown up, heavily blurred and pushed back with a deep vignette. */
.bl-stage[data-bg="cinematic"] .bl-backdrop[data-ready="1"]{opacity:1;filter:blur(64px) saturate(1.3) brightness(.46);transform:scale(1.35)}
.bl-stage[data-bg="cinematic"] .bl-bg-shade{background:radial-gradient(110% 85% at 50% 48%,rgba(0,0,0,.05) 25%,rgba(0,0,0,.72) 100%)}
/* Atmospheric gradient: deep album colours drifting slowly into near-black. */
.bl-bg-gradient{inset:auto;left:50%;top:50%;width:150cqmax;height:150cqmax;margin:-75cqmax 0 0 -75cqmax;background:radial-gradient(38% 34% at 30% 36%,var(--bl-grad-a),transparent 70%),radial-gradient(40% 36% at 72% 64%,var(--bl-grad-b),transparent 72%),radial-gradient(30% 30% at 62% 26%,var(--bl-grad-c),transparent 70%),#030305}
.bl-stage[data-bg="gradient"] .bl-bg-gradient{opacity:1;animation:bl-drift 70s linear infinite}
.bl-stage[data-bg="gradient"] .bl-bg-shade{background:radial-gradient(120% 90% at 50% 45%,transparent 30%,rgba(0,0,0,.6))}
/* Film grain: a muted tone from the album with moving analog grain and a soft vignette. */
.bl-bg-grain{inset:-10%;width:120%;height:120%;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)'/%3E%3C/svg%3E")}
.bl-stage[data-bg="grain"]{background:var(--bl-grain-base)}
.bl-stage[data-bg="grain"] .bl-bg-grain{opacity:.22;animation:bl-grain .9s steps(6) infinite}
.bl-stage[data-bg="grain"] .bl-bg-shade{background:radial-gradient(120% 90% at 50% 45%,transparent 35%,rgba(0,0,0,.55))}
@keyframes bl-grain{0%{transform:translate(0,0)}20%{transform:translate(-3%,2%)}40%{transform:translate(2%,-3%)}60%{transform:translate(-2%,-1%)}80%{transform:translate(3%,3%)}100%{transform:translate(0,0)}}
.bl-bg-pulse{opacity:0;background:radial-gradient(90% 70% at 50% 55%,color-mix(in srgb,var(--bl-pulse) 30%,transparent),transparent 70%);mix-blend-mode:screen}
.bl-ambient{inset:auto;left:50%;top:50%;width:125cqmax;height:125cqmax;margin:-62.5cqmax 0 0 -62.5cqmax}
.bl-stage[data-bg="ambient"] .bl-bg[data-ambient="1"] .bl-ambient{opacity:.9;animation:bl-drift 46s linear infinite}
.bl-stage[data-bg="ambient"] .bl-bg[data-ambient="1"] .bl-ambient-b{opacity:.35;mix-blend-mode:screen;animation:bl-drift-b 61s linear infinite}
.bl-bg-shade{opacity:1;background:radial-gradient(120% 90% at 50% 45%,rgba(0,0,0,.18) 0,rgba(0,0,0,.4) 55%,rgba(0,0,0,.8) 100%)}
.bl-stage[data-bg="art"] .bl-bg-shade{background:radial-gradient(120% 90% at 50% 45%,rgba(0,0,0,.12) 20%,rgba(0,0,0,.55))}
.bl-stage[data-bg="sky"] .bl-bg-shade,.bl-stage[data-bg="black"] .bl-bg-shade,.bl-stage[data-bg="none"] .bl-bg-shade{opacity:0}
.bl-stage[data-bg="none"] .bl-bg-pulse{display:none}
@keyframes bl-drift{from{transform:rotate(0) scale(1.1)}50%{transform:rotate(180deg) scale(1.3)}to{transform:rotate(360deg) scale(1.1)}}
@keyframes bl-drift-b{from{transform:rotate(360deg) scale(1.25) translate(4%,2%)}50%{transform:rotate(180deg) scale(1.05) translate(-3%,-2%)}to{transform:rotate(0) scale(1.25) translate(4%,2%)}}
.bl-lyrics{position:absolute;inset:0}
.bl-stage[data-bg="art"] .bl-lyrics,.bl-stage[data-bg="ambient"] .bl-lyrics,.bl-stage[data-bg="cinematic"] .bl-lyrics{text-shadow:0 2px 24px rgba(0,0,0,.45)}

/* Codestyle */
.bl-code{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.42em;font-family:"BL Mono",Consolas,monospace;font-size:calc(var(--bl-size)*.4);font-weight:700;padding:0 6vw;text-align:center;letter-spacing:-.01em}
.bl-code-row{transform:translateX(calc(var(--tx,0)*var(--bl-tilt,0)*1%)) rotate(calc(var(--rz,0)*var(--bl-tilt,0)*1deg));min-height:1.25em;max-width:min(88cqw,1500px);white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.3;color:var(--bl-secondary);transition:opacity .3s ease,font-size .3s ease;text-shadow:0 0 18px color-mix(in srgb,var(--bl-highlight) 30%,transparent)}
.bl-code-row[data-age="3"]{opacity:.22;font-size:.62em}
.bl-code-row[data-age="2"]{opacity:.42;font-size:.7em}
.bl-code-row[data-age="1"]{opacity:.72;font-size:.8em}
.bl-code-punc{color:color-mix(in srgb,var(--bl-highlight) 55%,#6b7090);opacity:.85}
.bl-code-current{color:var(--bl-highlight);font-size:1.12em;text-shadow:0 0 24px color-mix(in srgb,var(--bl-highlight) 55%,transparent),0 0 2px color-mix(in srgb,var(--bl-highlight) 80%,transparent)}
.bl-code-current .bl-code-punc{color:color-mix(in srgb,var(--bl-highlight) 70%,#fff);opacity:.7}
.bl-cursor{display:inline-block;width:.56em;height:1.08em;margin-left:.08em;vertical-align:-.17em;background:#ff3b4e;box-shadow:0 0 14px #ff3b4e,0 0 2px #ff8a96}
.bl-cursor-idle{animation:bl-blink 1.05s steps(1) infinite}
@keyframes bl-blink{50%{opacity:0}}

/* Constellation */
.bl-stars{position:absolute;inset:0}
.bl-cgroup{position:absolute;inset:0;transition:opacity 1.1s ease,transform 1.1s cubic-bezier(.16,1,.3,1);--bl-star:var(--bl-highlight);--bl-star-hi:color-mix(in srgb,var(--bl-highlight) 55%,#fff)}
.bl-cgroup-dim{opacity:.6}
.bl-cgroup-out{opacity:0;transform:scale(.97)}
.bl-clinks{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.bl-clinks line{stroke:color-mix(in srgb,var(--bl-star) 75%,#fff);stroke-width:calc(1.8px*var(--bl-star-scale,1));stroke-linecap:round;opacity:.72;stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset .6s cubic-bezier(.16,1,.3,1),opacity .6s ease}
.bl-clinks line.bl-link-halo{stroke:var(--bl-star);stroke-width:calc(9px*var(--bl-star-scale,1));opacity:.13}
.bl-clinks line.bl-fresh{opacity:1;stroke-width:calc(2.4px*var(--bl-star-scale,1))}
.bl-clinks line.bl-drawn{stroke-dashoffset:0}
.bl-star{position:absolute;width:0;height:0;--s:calc(var(--bl-size)*.1*var(--m,1)*var(--bl-star-scale,1));opacity:0;transition:opacity .45s ease}
.bl-star>i,.bl-star-glyph{position:absolute;left:0;top:0;pointer-events:none}
.bl-star-glyph{--g:calc(var(--bl-size)*.17*var(--m,1)*var(--bl-star-scale,1));width:var(--g);height:var(--g);margin:calc(var(--g)*-.5);overflow:visible;fill:var(--bl-star);filter:drop-shadow(0 0 calc(var(--g)*.2) color-mix(in srgb,var(--bl-star) 80%,transparent));transform:scale(.59);transition:transform .45s cubic-bezier(.16,1,.3,1),fill .3s ease}
.bl-star-halo{width:calc(var(--s)*3.2);height:calc(var(--s)*3.2);margin:calc(var(--s)*-1.6);border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--bl-star) 38%,transparent) 0,transparent 66%);opacity:.5}
.bl-star-ring{width:calc(var(--s)*1.9);height:calc(var(--s)*1.9);margin:calc(var(--s)*-.95);border-radius:50%;border:1.3px solid var(--bl-star);box-sizing:border-box;opacity:0;transform:scale(.5);transition:opacity .35s ease,transform .55s cubic-bezier(.16,1,.3,1)}
.bl-star-word{position:absolute;left:0;top:0;font-size:calc(var(--bl-size)*.165*var(--bl-star-text,1));font-weight:650;color:var(--bl-star);white-space:nowrap;opacity:.7;letter-spacing:.005em;transition:font-size .4s cubic-bezier(.16,1,.3,1),color .3s ease,opacity .3s ease;--tx:-50%;--ty:calc(-100% - var(--s)*.7)}
.bl-star[data-side="below"] .bl-star-word{--ty:calc(var(--s)*.7)}
.bl-star[data-align="start"] .bl-star-word{--tx:calc(var(--s)*-.4)}
.bl-star[data-align="end"] .bl-star-word{--tx:calc(-100% + var(--s)*.4)}
.bl-star-word{transform:translate(var(--tx),var(--ty))}
.bl-star.bl-pre{opacity:.55}
.bl-star.bl-pre .bl-star-word,.bl-star.bl-pre .bl-star-halo{opacity:0}
.bl-star.bl-pre .bl-star-glyph{transform:scale(.2)}
.bl-star.bl-on{opacity:.9}
.bl-star.bl-on .bl-star-halo{animation:bl-twinkle var(--tw,3s) ease-in-out var(--d,0s) infinite alternate}
.bl-star.bl-repeat .bl-star-word{font-size:calc(var(--bl-size)*.2*var(--bl-star-text,1));opacity:.8}
.bl-star.bl-now{opacity:1;--s:calc(var(--bl-size)*.17*var(--m,1)*var(--bl-star-scale,1))}
.bl-star.bl-now .bl-star-glyph{fill:var(--bl-star-hi);transform:scale(1)}
.bl-star.bl-now .bl-star-ring{opacity:.85;transform:scale(1)}
.bl-star.bl-now .bl-star-word{font-size:calc(var(--bl-size)*.4*var(--bl-star-text,1));font-weight:800;color:var(--bl-star-hi);opacity:1;text-shadow:0 0 .5em color-mix(in srgb,var(--bl-star) 45%,transparent)}
.bl-star.bl-arrive .bl-star-glyph{animation:bl-pop .7s cubic-bezier(.16,1,.3,1)}
.bl-star.bl-arrive .bl-star-halo{animation:bl-flash .9s ease-out}
@keyframes bl-twinkle{from{opacity:.25;transform:scale(.85)}to{opacity:.6;transform:scale(1.1)}}
@keyframes bl-pop{0%{transform:scale(.2) rotate(-60deg)}60%{transform:scale(1.25) rotate(4deg)}100%{transform:scale(1) rotate(0)}}
@keyframes bl-flash{0%{transform:scale(.3);opacity:1}40%{transform:scale(1.6);opacity:.9}100%{transform:scale(1);opacity:.5}}

/* Fisheye */
.bl-fish{position:absolute;inset:0;perspective:calc(var(--bl-size)*9);perspective-origin:50% 50%;font-weight:800;overflow:hidden}
.bl-fish-defs{position:absolute;width:0;height:0}
.bl-drum{position:absolute;inset:0;transform-style:preserve-3d;--bl-drum:calc(var(--bl-size)*1.55);font-size:var(--bl-drum)}
.bl-fish-word{position:absolute;left:50%;top:50%;display:flex;align-items:center;gap:.16em;white-space:nowrap;font-size:min(calc(1em*var(--bl-fit,1)),calc(150cqw/var(--bl-chars,6)));line-height:1;letter-spacing:-.035em;color:var(--bl-secondary);backface-visibility:hidden;will-change:transform,opacity;transform-origin:50% 50%}
.bl-fish-word[hidden]{display:none}
.bl-fish-tilt{display:inline-flex;align-items:center;gap:.16em;transform:translateX(calc(var(--tx,0)*var(--bl-tilt,0)*1%)) rotateZ(calc(var(--rz,0)*var(--bl-tilt,0)*1deg)) rotateY(calc(var(--ry,0)*var(--bl-tilt,0)*1deg));transform-style:preserve-3d}
.bl-fish-text{padding:.02em .1em .06em;border-radius:.08em;transition:color .25s ease,background-color .25s ease}
.bl-fish-focus{color:var(--bl-lyric)}
.bl-fish-focus .bl-fish-text{text-shadow:0 0 .5em color-mix(in srgb,var(--bl-highlight) 28%,transparent)}
.bl-fish-italic .bl-fish-text{font-style:italic}
.bl-fish-chip.bl-fish-next .bl-fish-text{background:var(--bl-highlight);color:var(--bl-ink);box-shadow:0 0 .6em color-mix(in srgb,var(--bl-highlight) 45%,transparent)}
.bl-fish-icon{display:inline-flex;width:.62em;height:.62em;flex:none}
.bl-fish-icon svg{width:100%;height:100%;fill:var(--bl-highlight);filter:drop-shadow(0 0 .18em color-mix(in srgb,var(--bl-highlight) 60%,transparent))}

/* Garden */
.bl-garden{position:absolute;inset:0;overflow:hidden}
.bl-garden-line{position:absolute;inset:0;display:grid;place-items:center;animation:bl-garden-in .45s cubic-bezier(.16,1,.3,1) both;transition:opacity .38s ease,transform .42s cubic-bezier(.4,0,1,1)}
.bl-garden-out{opacity:0;transform:translateY(-7%) scale(.96)}
@keyframes bl-garden-in{from{opacity:0;transform:translateY(4%)}}
.bl-garden-text{max-width:88cqw;text-align:center;text-wrap:wrap;font-family:var(--bl-garden-font,"BL Serif",Georgia,serif);font-weight:420;color:#fff;line-height:1.6;letter-spacing:-.01em;font-size:min(calc(var(--bl-size)*1.05),calc(215cqw/var(--bl-chars,10)))}
.bl-garden-word{position:relative;display:inline-block;white-space:nowrap}
.bl-garden-word[hidden],.bl-garden-letter[hidden]{display:none}
.bl-garden-word+.bl-garden-word{margin-left:.55em}
.bl-garden-letter{animation:bl-type .18s ease-out}
@keyframes bl-type{from{opacity:0}}
.bl-garden-caret{display:inline-block;width:.05em;height:.92em;margin-left:.04em;vertical-align:-.1em;background:currentColor;animation:bl-blink 1s steps(1) infinite}
.bl-garden-canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.bl-garden-fly{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.bl-butterfly path{fill:#fff}
.bl-butterfly-l,.bl-butterfly-r{animation:bl-flap .18s ease-in-out infinite alternate}
@keyframes bl-flap{from{transform:scaleX(1)}to{transform:scaleX(.2)}}

/* Edge glow */
.bl-glow{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.bl-glow[hidden]{display:none}
.bl-glow-layer{position:absolute;inset:0;will-change:opacity}
.bl-glow-ring,.bl-glow-bloom::before,.bl-glow-haze::before{position:absolute;inset:0;box-sizing:border-box;border:var(--bl-glow-w) solid transparent;background:conic-gradient(from 135deg,var(--bl-g1),var(--bl-g2),var(--bl-g1),var(--bl-g2),var(--bl-g1)) border-box;-webkit-mask:linear-gradient(#000 0 0) padding-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}
.bl-glow-ring{filter:brightness(1.35) saturate(1.1)}
.bl-glow-bloom,.bl-glow-haze{position:absolute;inset:0}
.bl-glow-bloom{filter:blur(calc(var(--bl-glow-blur)*.35))}
.bl-glow-bloom::before{content:"";border-width:calc(var(--bl-glow-w)*2.5 + 4px)}
.bl-glow-haze{filter:blur(var(--bl-glow-blur));opacity:.75}
.bl-glow-haze::before{content:"";border-width:calc(var(--bl-glow-w) + 30px)}
/* Music Sync: a dim frame with light that walks the edges on the beat. */
.bl-edge{position:absolute;overflow:visible;pointer-events:none;display:none}
.bl-glow[data-mode="music"] .bl-edge{display:block}
.bl-glow[data-mode="music"] .bl-glow-layer{opacity:.28}
.bl-glow[data-mode="music"] .bl-glow-spot{display:none}
.bl-edge-top,.bl-edge-bottom{left:0;right:0;height:var(--bl-glow-w)}
.bl-edge-left,.bl-edge-right{top:0;bottom:0;width:var(--bl-glow-w)}
.bl-edge-top{top:0}.bl-edge-bottom{bottom:0}.bl-edge-left{left:0}.bl-edge-right{right:0}
.bl-edge-line,.bl-edge-comet{position:absolute;inset:0;opacity:.22;will-change:opacity,transform}
.bl-edge-top .bl-edge-line,.bl-edge-bottom .bl-edge-line{background:linear-gradient(90deg,var(--bl-glow-a),var(--bl-glow-b) 50%,var(--bl-glow-a));box-shadow:0 0 calc(var(--bl-glow-blur)*.4) calc(var(--bl-glow-w)*.6) var(--bl-glow-a),0 0 calc(var(--bl-glow-blur)*1.3) calc(var(--bl-glow-w)*2) color-mix(in srgb,var(--bl-glow-b) 60%,transparent)}
.bl-edge-left .bl-edge-line,.bl-edge-right .bl-edge-line{background:linear-gradient(180deg,var(--bl-glow-b),var(--bl-glow-a) 50%,var(--bl-glow-b));box-shadow:0 0 calc(var(--bl-glow-blur)*.4) calc(var(--bl-glow-w)*.6) var(--bl-glow-a),0 0 calc(var(--bl-glow-blur)*1.3) calc(var(--bl-glow-w)*2) color-mix(in srgb,var(--bl-glow-b) 60%,transparent)}
.bl-edge-comet{opacity:0;background:var(--bl-glow-light,#fff);border-radius:99px;box-shadow:0 0 calc(var(--bl-glow-blur)*.35) calc(var(--bl-glow-w)*1.2) var(--bl-glow-a),0 0 calc(var(--bl-glow-blur)*1.4) calc(var(--bl-glow-w)*4) color-mix(in srgb,var(--bl-glow-a) 70%,transparent)}
.bl-edge-top .bl-edge-comet,.bl-edge-bottom .bl-edge-comet{right:auto;width:45%}
.bl-edge-left .bl-edge-comet,.bl-edge-right .bl-edge-comet{bottom:auto;height:45%}
/* Orbit: a half-frame arc that steps around the edge on each beat. */
.bl-orbit{position:absolute;inset:0;display:none;overflow:hidden;box-sizing:border-box;border:calc(var(--bl-glow-w)*1.6 + 1px) solid transparent;-webkit-mask:linear-gradient(#000 0 0) padding-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}
.bl-orbit-bloom{border-width:calc(var(--bl-glow-w)*5 + 18px);filter:blur(calc(var(--bl-glow-blur)*.4));opacity:1}
.bl-glow[data-mode="orbit"] .bl-orbit{display:block}
.bl-glow[data-mode="orbit"] .bl-glow-layer{opacity:.22}
.bl-glow[data-mode="orbit"] .bl-glow-spot{display:none}
.bl-orbit{opacity:.85}
.bl-orbit-drift,.bl-orbit-beat{position:absolute;left:50%;top:50%;width:0;height:0;will-change:transform}
.bl-orbit-wide{opacity:0;background:conic-gradient(from -40deg,transparent 0deg,color-mix(in srgb,var(--bl-glow-b) 60%,transparent) 50deg,var(--bl-glow-a) 140deg,var(--bl-glow-light,#fff) 205deg,var(--bl-glow-light,#fff) 214deg,transparent 220deg,transparent 360deg)!important}
.bl-orbit-spin{position:absolute;left:0;top:0;width:150cqmax;height:150cqmax;margin:-75cqmax 0 0 -75cqmax;background:conic-gradient(from 0deg,transparent 0deg,var(--bl-glow-b) 30deg,var(--bl-glow-a) 85deg,var(--bl-glow-light,#fff) 140deg,var(--bl-glow-light,#fff) 176deg,transparent 180deg,transparent 360deg);will-change:transform}
.bl-glow-spot{position:absolute;left:0;top:0;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--bl-glow-a) 80%,#fff) 0,var(--bl-glow-a) 12%,color-mix(in srgb,var(--bl-glow-a) 25%,transparent) 34%,transparent 62%);opacity:.26;mix-blend-mode:screen;will-change:transform}
.bl-glow-spot-b{background:radial-gradient(circle,color-mix(in srgb,var(--bl-glow-b) 80%,#fff) 0,var(--bl-glow-b) 12%,color-mix(in srgb,var(--bl-glow-b) 25%,transparent) 34%,transparent 62%)}
`;
