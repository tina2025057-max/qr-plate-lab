# QR Plate Lab

樂技數位教育的 QR Code 3D 列印標牌設計工具。輸入網址、調整款式與尺寸，即可在瀏覽器中預覽並下載 STL / SVG；桌上立牌可下載分件列印的檔案。

## GitHub Pages

此 repository 使用 GitHub Actions 將 `public/` 發佈到 GitHub Pages。首次發布前，請在 **Settings → Pages → Build and deployment** 將 Source 設為 **GitHub Actions**。推送到 `main` 後，Actions 會自動部署。

## 本機預覽

用任一靜態 HTTP 伺服器提供 `public/` 資料夾即可。請勿直接用 `file://` 開啟，因為 3D 模組需要 HTTP 模組載入。

## 技術

純前端靜態網站；3D 預覽與 STL 產生均在瀏覽器執行。QR 編碼使用 jsDelivr 上的 `qrcode-generator`。
