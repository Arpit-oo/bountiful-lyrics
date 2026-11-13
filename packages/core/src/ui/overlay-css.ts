export const OVERLAY_CSS = `
.bl-overlay{position:fixed;inset:0;z-index:2147483000;background:#000;color:#f4f1ea;font-family:"BL Jakarta","Segoe UI",sans-serif}
.bl-overlay[hidden]{display:none}
.bl-overlay button,.bl-overlay select,.bl-overlay input{font:inherit}
.bl-overlay :focus-visible{outline:2px solid #fff;outline-offset:2px}

.bl-player{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:24px}
.bl-player[hidden]{display:none}
.bl-player-art{width:min(38vh,420px);aspect-ratio:1;border-radius:18px;object-fit:cover;box-shadow:0 24px 80px rgba(0,0,0,.7);background:#16161c}
.bl-player-title{margin:10px 0 0;font-size:24px;font-weight:700}
.bl-player-artist{margin:0;font-size:15px;color:rgba(255,255,255,.62)}
.bl-status{margin:0;font-size:14px;color:rgba(255,255,255,.55)}

.bl-plain{position:absolute;inset:0;overflow-y:auto;padding:12vh 8vw;text-align:center;font-size:clamp(20px,3vh,34px);font-weight:600;line-height:1.7;color:var(--bl-plain,#f4f1ea)}
.bl-plain[hidden]{display:none}
.bl-plain p{margin:0;min-height:1.7em}
.bl-plain small{display:block;margin-top:32px;font-size:13px;font-weight:500;color:rgba(255,255,255,.45)}

.bl-overlay[data-mode="page"]{position:absolute;z-index:20;border-radius:inherit;overflow:hidden}
.bl-pip-body{margin:0;background:#000;overflow:hidden}
/* Pop-out window: no OS frame, so the stage drags and invisible edges resize. */
.bl-win-edge{display:none;position:absolute;z-index:6}
.bl-overlay[data-mode="window"] .bl-win-edge{display:block}
.bl-overlay[data-mode="window"]{cursor:grab}
.bl-overlay.bl-dragging{cursor:grabbing}
.bl-overlay.bl-dragging .bl-chrome,.bl-overlay.bl-resizing .bl-chrome{pointer-events:none}
.bl-win-n,.bl-win-s{left:26px;right:26px;height:14px}
.bl-win-e,.bl-win-w{top:26px;bottom:26px;width:14px}
.bl-win-n{top:0;cursor:ns-resize}.bl-win-s{bottom:0;cursor:ns-resize}
.bl-win-e{right:0;cursor:ew-resize}.bl-win-w{left:0;cursor:ew-resize}
.bl-win-ne,.bl-win-nw,.bl-win-se,.bl-win-sw{width:26px;height:26px}
.bl-win-ne{top:0;right:0;cursor:nesw-resize}.bl-win-sw{bottom:0;left:0;cursor:nesw-resize}
.bl-win-nw{top:0;left:0;cursor:nwse-resize}.bl-win-se{bottom:0;right:0;cursor:nwse-resize}
.bl-win-se::after{content:"";position:absolute;right:7px;bottom:7px;width:9px;height:9px;border-right:2px solid rgba(255,255,255,.45);border-bottom:2px solid rgba(255,255,255,.45);border-bottom-right-radius:3px;opacity:0;transition:opacity .25s ease}
.bl-overlay[data-mode="window"]:not(.bl-idle) .bl-win-se::after{opacity:1}
.bl-toast{position:absolute;left:50%;top:22px;z-index:7;transform:translate(-50%,-8px);padding:10px 16px;border-radius:999px;background:rgba(20,20,26,.82);border:1px solid rgba(255,255,255,.1);font-size:13px;font-weight:600;color:#fff;opacity:0;pointer-events:none;transition:opacity .3s ease,transform .3s cubic-bezier(.16,1,.3,1);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);white-space:nowrap}
.bl-toast.bl-toast-on{opacity:1;transform:translate(-50%,0)}
.bl-bg-btn{overflow:hidden;padding:0}
.bl-bg-btn img{width:24px;height:24px;border-radius:6px;object-fit:cover;box-shadow:0 0 0 1.5px rgba(255,255,255,.5)}
.bl-bg-btn[aria-pressed="true"]{color:var(--bl-accent,#fff)}
/* Inside Spotify the real playbar sits right below, so only keep what it lacks. */
.bl-overlay[data-mode="page"] .bl-chrome-left,.bl-overlay[data-mode="page"] .bl-chrome-center{visibility:hidden}
.bl-overlay[data-mode="page"] .bl-chrome{background:linear-gradient(transparent,rgba(0,0,0,.45));padding-top:28px}

.bl-chrome{position:absolute;left:0;right:0;bottom:0;z-index:3;display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,560px) minmax(0,1fr);align-items:center;gap:20px;padding:44px 24px 18px;background:linear-gradient(transparent,rgba(0,0,0,.5) 40%,rgba(0,0,0,.82));transition:opacity .35s ease,transform .35s ease}
.bl-chrome-left{display:flex;align-items:center;gap:12px;min-width:0}
.bl-mini-art{width:48px;height:48px;border-radius:8px;object-fit:cover;flex:none;background:#1b1b22;box-shadow:0 6px 20px rgba(0,0,0,.5)}
.bl-mini-meta{min-width:0;display:flex;flex-direction:column;gap:2px}
.bl-mini-title{font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bl-mini-artist{font-size:12.5px;color:rgba(255,255,255,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bl-chrome-center{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0}
.bl-transport{display:flex;align-items:center;gap:10px}
.bl-seek-row{display:flex;align-items:center;gap:10px;width:100%}
.bl-time{flex:none;min-width:38px;font-size:11.5px;font-variant-numeric:tabular-nums;color:rgba(255,255,255,.6);text-align:center}
.bl-chrome-right{display:flex;align-items:center;justify-content:flex-end;gap:6px;min-width:0}
.bl-volume{display:flex;align-items:center;gap:4px;margin-right:6px}
.bl-modes{display:flex;gap:2px;padding:3px;border-radius:999px;background:rgba(255,255,255,.07);margin:0 4px}
.bl-modes .bl-icon-btn{background:transparent}
.bl-modes .bl-icon-btn[aria-pressed="true"]{background:rgba(255,255,255,.92);color:#000}
.bl-seek,.bl-vol{-webkit-appearance:none;appearance:none;height:16px;margin:0;background:transparent;cursor:pointer;--bl-fill:0%}
.bl-seek{flex:1;min-width:0}
.bl-vol{width:96px}
.bl-seek::-webkit-slider-runnable-track,.bl-vol::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:linear-gradient(90deg,#fff var(--bl-fill),rgba(255,255,255,.22) var(--bl-fill))}
.bl-seek:hover::-webkit-slider-runnable-track,.bl-vol:hover::-webkit-slider-runnable-track{background:linear-gradient(90deg,var(--bl-accent,#fff) var(--bl-fill),rgba(255,255,255,.25) var(--bl-fill))}
.bl-seek::-webkit-slider-thumb,.bl-vol::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;margin-top:-4px;border-radius:50%;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.5);opacity:0;transition:opacity .15s ease}
.bl-seek:hover::-webkit-slider-thumb,.bl-vol:hover::-webkit-slider-thumb,.bl-seek:focus-visible::-webkit-slider-thumb,.bl-vol:focus-visible::-webkit-slider-thumb{opacity:1}
.bl-close{position:absolute;top:16px;right:18px;z-index:3;display:flex;align-items:center;gap:10px;transition:opacity .35s ease}
/* Spotify draws its own window buttons over the top-right corner, so fullscreen and pop-out close on the left. */
.bl-overlay[data-mode="fullscreen"] .bl-close,.bl-overlay[data-mode="window"] .bl-close{right:auto;left:18px;flex-direction:row-reverse}
.bl-close-hint{font-size:12px;font-weight:650;color:rgba(255,255,255,.55);padding:4px 8px;border-radius:7px;background:rgba(255,255,255,.08)}
.bl-overlay.bl-idle{cursor:none}
.bl-overlay.bl-idle .bl-chrome{opacity:0;transform:translateY(12px);pointer-events:none}
.bl-overlay.bl-idle .bl-close{opacity:0;pointer-events:none}
.bl-icon-btn{width:40px;height:40px;display:grid;place-items:center;border:0;border-radius:50%;background:rgba(255,255,255,.08);color:#fff;cursor:pointer;transition:background-color .15s ease,transform .15s ease,color .15s ease;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.bl-icon-btn:hover{background:rgba(255,255,255,.18)}
.bl-icon-btn:active{transform:scale(.94)}
.bl-icon-btn[hidden]{display:none}
.bl-icon-btn:disabled{opacity:.35;cursor:default}
.bl-icon-btn svg{width:19px;height:19px;fill:currentColor}
.bl-icon-sm{width:34px;height:34px;background:transparent}
.bl-icon-sm svg{width:17px;height:17px}
.bl-icon-btn.bl-play{width:48px;height:48px;background:#fff;color:#000}
.bl-icon-btn.bl-play:hover{background:#fff;transform:scale(1.05)}
.bl-toggle-btn[aria-pressed="true"]{color:var(--bl-accent,#fff)}
@container (max-width:760px){.bl-chrome{grid-template-columns:1fr;padding-top:28px}.bl-chrome-left{display:none}.bl-chrome-right{justify-content:center}}
.bl-overlay{container-type:size}

.bl-scrim{position:absolute;inset:0;z-index:8;display:grid;place-items:center;background:rgba(0,0,0,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:bl-fade .2s ease}
@keyframes bl-fade{from{opacity:0}}
.bl-dialog{box-sizing:border-box;width:85vw;max-width:896px;height:min(86vh,760px);display:grid;grid-template-rows:auto 1fr auto;border-radius:22px;background:linear-gradient(180deg,rgba(30,30,38,.97),rgba(18,18,24,.98));border:1px solid rgba(255,255,255,.09);box-shadow:0 40px 140px rgba(0,0,0,.75),inset 0 1px 0 rgba(255,255,255,.06);overflow:hidden;animation:bl-rise .28s cubic-bezier(.16,1,.3,1)}
@keyframes bl-rise{from{opacity:0;transform:translateY(12px) scale(.98)}}
.bl-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:24px 28px;border-bottom:1px solid rgba(255,255,255,.07)}
.bl-dialog-title{margin:0;font-size:22px;font-weight:800;letter-spacing:-.01em}
.bl-dialog-sub{margin:4px 0 0;font-size:13px;color:rgba(255,255,255,.5)}
.bl-dialog-body{display:grid;grid-template-columns:200px 1fr;min-height:0}
.bl-tabs{display:flex;flex-direction:column;gap:4px;padding:18px 12px;border-right:1px solid rgba(255,255,255,.07)}
.bl-tab{display:flex;align-items:center;gap:12px;height:44px;padding:0 14px;border:0;border-radius:12px;background:transparent;color:rgba(255,255,255,.7);font-size:14.5px;font-weight:650;text-align:left;cursor:pointer;transition:background-color .15s ease,color .15s ease}
.bl-tab svg{width:18px;height:18px;fill:currentColor;flex:none}
.bl-tab:hover{background:rgba(255,255,255,.06);color:#fff}
.bl-tab[aria-selected="true"]{background:rgba(255,255,255,.1);color:#fff}
.bl-panel{overflow-y:auto;padding:22px 28px 28px;display:flex;flex-direction:column;gap:28px;scrollbar-width:thin}
.bl-section{display:flex;flex-direction:column;gap:14px}
.bl-section-title{margin:0;font-size:12px;font-weight:750;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.45)}
.bl-field{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px 24px;min-height:44px}
.bl-dialog:focus{outline:none}
.bl-field-text{display:flex;flex-direction:column;gap:2px;min-width:0}
.bl-field-label{font-size:15px;font-weight:600;color:rgba(255,255,255,.92)}
.bl-field-hint{font-size:12.5px;color:rgba(255,255,255,.48)}
.bl-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.bl-card{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:10px 10px 14px;border:1.5px solid rgba(255,255,255,.08);border-radius:16px;background:rgba(255,255,255,.03);color:#fff;text-align:left;cursor:pointer;transition:border-color .15s ease,background-color .15s ease,transform .15s ease}
.bl-card:hover{background:rgba(255,255,255,.06);transform:translateY(-1px)}
.bl-card[aria-pressed="true"]{border-color:var(--bl-accent,#fff);background:color-mix(in srgb,var(--bl-accent,#fff) 10%,transparent)}
.bl-card-art{display:block;width:100%;aspect-ratio:12/7;border-radius:10px;background:#000;color:#fff;margin-bottom:8px;overflow:hidden}
.bl-card-art svg{width:100%;height:100%}
.bl-card-name{font-size:14.5px;font-weight:750;padding:0 4px}
.bl-card-blurb{font-size:12px;color:rgba(255,255,255,.5);padding:0 4px;line-height:1.35}
.bl-fonts{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
.bl-font{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:12px 14px;border:1.5px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.03);color:#fff;cursor:pointer;text-align:left;transition:border-color .15s ease,background-color .15s ease}
.bl-font:hover{background:rgba(255,255,255,.06)}
.bl-font[aria-pressed="true"]{border-color:var(--bl-accent,#fff)}
.bl-font-sample{font-size:30px;line-height:1}
.bl-font-name{font-size:12px;color:rgba(255,255,255,.6)}
.bl-bgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:12px}
.bl-bg-tile{display:flex;flex-direction:column;gap:8px;padding:8px 8px 12px;border:1.5px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.03);color:#fff;cursor:pointer;text-align:left;transition:border-color .15s ease,background-color .15s ease}
.bl-bg-tile:hover{background:rgba(255,255,255,.06)}
.bl-bg-tile[aria-pressed="true"]{border-color:var(--bl-accent,#fff)}
.bl-bg-preview{display:block;width:100%;aspect-ratio:16/9;border-radius:9px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)}
.bl-bg-name{font-size:13px;font-weight:650;padding:0 4px}
.bl-seg{display:inline-flex;flex:none;gap:2px;padding:3px;border-radius:12px;background:rgba(255,255,255,.07)}
.bl-seg-btn{height:34px;padding:0 14px;border:0;border-radius:9px;background:transparent;color:rgba(255,255,255,.75);font-size:13.5px;font-weight:650;cursor:pointer;transition:background-color .15s ease,color .15s ease}
.bl-seg-btn:hover{color:#fff}
.bl-seg-btn[aria-checked="true"]{background:#fff;color:#000}
.bl-switch{position:relative;width:46px;height:28px;flex:none;border:0;border-radius:99px;background:rgba(255,255,255,.18);cursor:pointer;transition:background-color .2s ease}
.bl-switch::after{content:"";position:absolute;left:3px;top:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.4);transition:transform .25s cubic-bezier(.16,1,.3,1)}
.bl-switch[aria-checked="true"]{background:var(--bl-accent,#3ddc84)}
.bl-switch[aria-checked="true"]::after{transform:translateX(18px)}
.bl-slider{display:flex;align-items:center;gap:12px;width:min(300px,50%)}
.bl-range{-webkit-appearance:none;appearance:none;flex:1;height:20px;margin:0;background:transparent;cursor:pointer;--bl-fill:50%}
.bl-range::-webkit-slider-runnable-track{height:5px;border-radius:3px;background:linear-gradient(90deg,#fff var(--bl-fill),rgba(255,255,255,.18) var(--bl-fill))}
.bl-range::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;margin-top:-6.5px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.5)}
.bl-slider-value{min-width:46px;text-align:right;white-space:nowrap;font-size:13px;font-variant-numeric:tabular-nums;color:rgba(255,255,255,.7)}
.bl-colour{position:relative}
.bl-swatch{width:52px;height:34px;border:0;border-radius:10px;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(255,255,255,.25),0 2px 10px rgba(0,0,0,.35)}
.bl-wheel-pop{position:absolute;right:0;top:calc(100% + 10px);z-index:3;display:flex;flex-direction:column;gap:12px;width:228px;padding:16px;border-radius:18px;background:#1d1d25;border:1px solid rgba(255,255,255,.1);box-shadow:0 24px 70px rgba(0,0,0,.7);animation:bl-rise .2s cubic-bezier(.16,1,.3,1)}
.bl-wheel-pop.bl-up{top:auto;bottom:calc(100% + 10px)}
.bl-wheel{position:relative;width:196px;height:196px;align-self:center;cursor:crosshair;touch-action:none}
.bl-wheel-canvas{width:196px;height:196px;border-radius:50%;display:block}
.bl-wheel-marker{position:absolute;left:0;top:0;width:18px;height:18px;margin:-9px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.4),0 2px 6px rgba(0,0,0,.5);pointer-events:none}
.bl-wheel-value{-webkit-appearance:none;appearance:none;width:100%;height:14px;border-radius:7px;background:linear-gradient(90deg,#000,var(--bl-hue,#fff));cursor:pointer}
.bl-wheel-value::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:#fff;border:2px solid rgba(0,0,0,.3)}
.bl-wheel-row{display:flex}
.bl-wheel-hex{width:100%;height:34px;padding:0 10px;border:1px solid rgba(255,255,255,.14);border-radius:9px;background:#14141a;color:#fff;font:600 13px "BL Mono",Consolas,monospace;text-transform:lowercase}
.bl-wheel-presets{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}
.bl-wheel-preset{aspect-ratio:1;border:0;border-radius:7px;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)}
.bl-keys{display:grid;grid-template-columns:max-content 1fr;gap:10px 16px;margin:0}
.bl-keys dt{min-width:44px;padding:4px 8px;border-radius:7px;background:rgba(255,255,255,.1);font:700 12px "BL Mono",Consolas,monospace;text-align:center}
.bl-keys dd{margin:0;align-self:center;font-size:14px;color:rgba(255,255,255,.75)}
.bl-hint{margin:0;font-size:13px;line-height:1.55;color:rgba(255,255,255,.55)}
.bl-dialog-foot{display:flex;align-items:center;justify-content:space-between;padding:16px 28px;border-top:1px solid rgba(255,255,255,.07)}
.bl-btn{height:40px;padding:0 20px;border:0;border-radius:11px;background:#fff;color:#000;font-size:14px;font-weight:750;cursor:pointer;transition:opacity .15s ease}
.bl-btn:hover{opacity:.9}
.bl-btn-quiet{background:rgba(255,255,255,.08);color:#fff}
@container (max-width:720px){.bl-dialog-body{grid-template-columns:1fr}.bl-tabs{flex-direction:row;overflow-x:auto;border-right:0;border-bottom:1px solid rgba(255,255,255,.07);padding:10px}.bl-tab span{display:none}.bl-slider{width:55%}}
`;
