; custom.nsh — DEEP Installer NSIS Theme
; Pure color theming via NSIS SetCtlColors API.
; No external bitmap artwork — all colors are defined here.
;
; Palette:
;   Background   #121110  (ember dark)
;   Text         #F2E6D9  (warm cream)
;   Brand        #D27838  (amber)

; ── Apply dark theme to the installer window ──────────────────────────────────
; Called on each page's show event via MUI2 callback hooks.

!macro customWelcomePage
  ; Make the parent dialog dark
  SetCtlColors $HWNDPARENT "F2E6D9" "121110"
!macroend

!macro customInstallPage
  SetCtlColors $HWNDPARENT "F2E6D9" "121110"
!macroend

!macro customFinishPage
  SetCtlColors $HWNDPARENT "F2E6D9" "121110"
!macroend

; ── Window title ──────────────────────────────────────────────────────────────
; electron-builder sets this from productName automatically.
; This hook lets us append a tagline.
!macro customHeader
  !system "echo Building DEEP installer..."
!macroend
