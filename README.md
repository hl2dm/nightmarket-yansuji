# 阿恩鹽酥雞 — 台灣夜市攤位系列 #1(v3.2)

直接用瀏覽器開 `index.html` 即可(純 HTML5/JS,可放 GitHub Pages)。網址參數:`?seed=42`、`?speed=2`、`?autostart`。

## 玩法(一晚 3 分鐘)
客人點餐 → 點食材櫃(A–H)直接下到長方形油槽的 6 個方籃 → 油溫 Q/W/E → 每格熟度條轉綠「剛好!」按該格數字 1–6 撈起(空白鍵撈全部剛好的)→ 調味 Z/X/C、剪 V、裝袋 Enter → 出餐收錢,面對殺價可「成交/讓價/堅持/拒絕」,可疑自備食材客可「🚨檢舉」。收攤後結算。

## 平衡說明
第一晚攤租 $500(設計稿為 $800,實測太苛,詳見 design.md 附錄)。

## 素材
- `art/`:AI(Grok Imagine)生成背景、客人立繪、食材圖;`art/src/` 為原始圖。
- `clips/`:AI 生成的模擬遊玩影片(clip1–5 與合輯 mock_gameplay_reel.mp4)。
- `v2g_study/`:用 lovisdotio/video-to-game 的 study_video.py 分析合輯的結果。
- 參考作品《Probably Stolen / 深空當鋪》只參考結構與風格,未使用其素材或名稱。
- 油鍋美術(第三版俯視):art/fryer_top.jpg、art/basket_top.png(原圖 art/src/*_topdown_src.jpg);舊版 fryer_tank.png/fry_basket.png 保留未用

## 第二版:經營模式(多晚)
- 流程:標題 → 開攤前進貨 → 營業 → 收攤結算(付攤租、剩料報廢)→ 設備店 → 下一晚。
- 上方「菜單夾」:每位客人一張單(頭像、品項、辣/塔、倒數);綠/橘/紅代表耐心,櫃台那張是金框。
- 起始現金 $1000,攤租第 1 晚 $300、每晚 +$80;付不出會欠債(下晚 ×1.2),連兩晚付不出就 GAME OVER。
- 缺貨:客人點到沒貨的會出現「道歉換單 / 請客人離開」。
- 升級 7 種(8 格油槽、冰箱、濾油機、霓虹招牌、電風扇、快剪、批發卡),每晚最多 2 項。油槽 8 格時鍵 1–8。
- 自動存檔在 localStorage `yansuji_save_v2`,標題畫面可「繼續」。
- 多晚自動試玩:`node ../_tools/multinight.mjs <晚數> <seed> <speed>`


## 第三版:俯視油槽 + 大/小網(design.md §16)
- 油槽佔滿畫面中央,6×3 格:大網 2×2(1–3 號)放雞排/魷魚/杏鮑菇,小網 1×1(4–9 號)放小料;小網滿才用大網。
- 設備店:加大網 $600(第 3 個大網)、加小網 $300(+2 小網)。
- 鍵盤:A–J 下料、1–9 撈網、空白鍵撈熟的、QWE 油溫、ZXC 調味、V 剪、Enter 裝袋、O 換油。
- 測試:`node _tools/multinight.mjs 6 7 4`、`node _tools/fullgrid_shot.mjs`(滿配截圖)。

### v3.1 客人走上前
菜單夾與油槽之間加回街景條:客人從左側巷口走來→排隊(耐心條)→櫃台點單(單上菜單夾)→取餐開心離開或生氣💢離開。網滿標示移到庫存小標籤。見 design.md §17。

## v3.2 油炸音效 + Grok 像素素材
- **音效(`audio.js`,全程序生成 Web Audio,無外部音檔)**:第一次點擊/按鍵才啟動。右上角音量鈕或 **M 鍵**循環 靜音/小/中/大(存 localStorage `yansuji_vol`)。
  - 連續油泡底噪:粉紅雜訊→帶通(LFO 咕嘟)+ 高通嘶嘶,音量隨「油裡的網數」與油溫上升;空鍋只剩微弱熱油聲,換油中/非營業靜下來。
  - 下鍋:大聲爆嘶 + 低沉「轟」+ 1 秒內一串劈啪與氣泡。炸的時候隨機劈啪/油泡,頻率隨網數與油溫增加。
  - 剛好:兩音鈴「叮–咚」;快焦前預警:雙短嗶 + 嘶;焦了:低沉下滑音。撈起:金屬籃碰撞 + 嘶聲收尾 + 滴油聲。
  - UI:客人到櫃台點單鈴、收錢收銀機(咔+抽屜+叮叮)、剪刀聲、按鈕點擊。
  - `?mute=1` 或自動化瀏覽器(navigator.webdriver)完全不建立 AudioContext;multinight.mjs 已加 `&mute=1`。
- **素材**:`_tools/cutout.py` 把 grok_pack 綠幕圖去背(色差容差 + 邊緣連通 + 純綠洞 + 邊緣去溢色)、裁邊、縮放到 `assets/`。
  - 油槽格內食材:生料圖→炸好圖依熟度淡入,過熟變暗,焦了換焦黑圖;熟度膠囊與色條保留,一眼看得出。
  - 大網/小網籃子、油槽、攤位前景(遊戲背景)、場景背景(標題=攤位、進貨=夜市中景、設備店、結算)、升級圖示、HUD 現金/口碑圖示。
  - 跳過:prop_oil_fresh(全綠空白)、pilot ui_coin(有文字)。其他已去背但尚未用上的在 assets/ 備用。
- 備份:game_v31_backup.js、index_v31_backup.html、README_v31_backup.md、../_tools/multinight_v31_backup.mjs。截圖:`node ../_tools/assets_shot.mjs` → screenshots/22_assets_*.png。
