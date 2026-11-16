# 待補素材（給繪圖用）

遊戲：夜市鹽酥雞攤。畫面邏輯尺寸 1280×720，實際以 2 倍繪製。
風格對齊已交的 `public/assets/`：低飽和像素、nearest-neighbour。不要向量、不要寫實照片、不要圓角色塊。

把新檔放進 `public/assets/`，檔名照下表，不要改已交的檔。

## 不要重畫

這些已經在用，畫風以它們為準：

- `bg_counter.png` 2560×488
- `fryer_body.png` 1272×436
- `plate_well.png` 544×224
- `rack_board.png` 1208×176
- `slip.png` 496×60
- `note_regular.png` 308×144
- `basket_big.png` 284×312、`basket_small.png` 284×148
- `cust_*.png` 十二張，480×784，頭到腰、透明背景

## 這次要畫

全部透明背景，不要文字、不要盤子、不要招牌上的字。食物佔畫面中間約七成。

| 檔名 | 尺寸 | 內容 |
|---|---|---|
| `food_porkskewer_raw.png` | 512×512 | 生豬肉串。現在的檔是紅方塊，不能用 |
| `food_porkskewer_fried.png` | 512×512 | 炸好的豬肉串，金黃，看得出是同一支 |
| `food_babycorn_raw.png` | 512×512 | 生玉米筍。現在是黃色叉叉 |
| `food_babycorn_fried.png` | 512×512 | 炸玉米筍 |
| `food_greenpepper_raw.png` | 512×512 | 生青椒。現在是綠圈 |
| `food_greenpepper_fried.png` | 512×512 | 炸青椒 |
| `food_sweetpotato_raw.png` | 512×512 | 生地瓜，切塊或條 |
| `food_sweetpotato_fried.png` | 512×512 | 炸地瓜 |
| `food_squidball_raw.png` | 512×512 | 生花枝丸 |
| `food_squidball_fried.png` | 512×512 | 炸花枝丸 |
| `food_silverbun_raw.png` | 512×512 | 生銀絲卷 |
| `food_silverbun_fried.png` | 512×512 | 炸銀絲卷 |
| `upg_neon.png` | 192×192 | 夜市霓虹招牌。現在是發光箱子 |
| `upg_bulk.png` | 192×192 | 批發會員卡或印章。現在是一堆零件 |
| `upg_bigNet.png` | 192×192 | 大炸網，編法和 `basket_big.png` 一樣。現在是洗碗籃 |
| `upg_smallNet.png` | 192×192 | 小炸網，編法和 `basket_small.png` 一樣 |
| `shaker_salt.png` | 296×208 | 胡椒鹽罐，正面，標籤留白 |
| `shaker_chili.png` | 296×208 | 辣粉罐，正面，標籤留白 |
| `shaker_basil.png` | 296×208 | 九層塔罐，正面，標籤留白。三個罐子同一造型，只換內容顏色 |
| `bowl_steel.png` | 440×360 | 空的不鏽鋼鐵盆，俯視，盆裡不要放食物 |
| `case_glass.png` | 600×840 | 玻璃展示櫃外框。中間必須透明，食物圖要從洞裡看見 |
| `font.ttf` 或 `font.otf` | 一套 | 可商用的中文像素字。介面現在用系統黑體 |

生與炸必須是同一塊食材的兩個狀態，輪廓接近，炸的變金黃、有油光，不要換成另一種食物。

## 不要畫

- 貓
- 客人、油鍋、點餐紙、瀝油架、起鍋盤、熟客紙條（已有）
- 按鈕、進貨表、結算頁。那些先用程式字，這批圖進來再換
- 油鍋裡的「加購」格。沒買小網時該格不顯示
