import os
from google.cloud import bigquery

# 認証ファイルのパスをここに指定（↓あなたのJSONファイルパス）
#os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "/Users/toki-mac/Downloads/extreme-core-447003-m3-88f2778773a4.json"
# Base64でエンコードされたJSON文字列をSecretsから取得
b64_json = st.secrets["GOOGLE_APPLICATION_CREDENTIALS_JSON"]

# 一時ファイルとして書き出す
tmp_json_path = "/tmp/gcp_key.json"
with open(tmp_json_path, "wb") as f:
    f.write(base64.b64decode(b64_json))

# 環境変数にセット（BigQueryライブラリがここを参照）
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = tmp_json_path

# BigQueryクライアント作成
client = bigquery.Client()


import pandas as pd
import matplotlib.pyplot as plt
import streamlit as st
import matplotlib.ticker as ticker


st.title("📈 Global Career Community Instagram分析")

st.header("① フォロワー数の推移")

# 多分いらない　followers_path = '/Users/toki-mac/Downloads/Streamlit data/GCC instagram data graph - InstagramData.csv'
# 多分いらない　df_followers = pd.read_csv(followers_path)

query_followers = """
SELECT date, username, title, followers, posts_number, profile_image
FROM `insta-data-460018.insta_dataset_us.followers`
"""

df_followers = client.query(query_followers).to_dataframe()

df_followers.columns = ["取得日時", "ユーザーネーム", "名前", "フォロワー数", "投稿数", "プロフィール画像"]
df_followers["取得日"] = pd.to_datetime(df_followers["取得日時"]).dt.date
df_daily = df_followers.groupby("取得日").last().reset_index()
df_daily["増減"] = df_daily["フォロワー数"].diff()
df_daily["フラグ"] = df_daily["増減"].apply(
    lambda x: "データなし" if pd.isna(x) else ("増加" if x > 0 else ("減少" if x < 0 else "変化なし"))
)
st.dataframe(df_daily[["取得日", "フォロワー数", "増減", "フラグ"]])
st.line_chart(df_daily.set_index("取得日")["フォロワー数"])




st.header("② 日ごとの「合計リーチ数」")
st.write("日ごとの合計リーチ数を表示中。")

# posts_path = '/Users/toki-mac/Downloads/Streamlit data/GCC insta 0414.csv'
# df_posts = pd.read_csv(posts_path, dtype={"__ID": str}) # 投稿IDが文字列なので dtype を指定

query_posts = """
SELECT date, ID, posted_date, media_type, view_count, reach, save, `like`, `comment`, `share`
FROM `insta-data-460018.insta_dataset_us.test`
"""

df_posts = client.query(query_posts).to_dataframe()

df_posts.columns = ["実行日時", "投稿ID", "投稿日時", "投稿種別", "再生回数", "リーチ", "保存数", "いいね数", "コメント数", "シェア数"] 
df_posts["実行日時"] = df_posts["実行日時"].str.replace(r"\d{2}:\d{2}$", "00:00", regex=True) # 実行日時から時刻部分の分を00にする（例：13:24 → 13:00）
df_posts["実行日"] = pd.to_datetime(df_posts["実行日時"]).dt.date # 実行日だけ取り出した列を追加（あとでグラフに使える）
df_posts["リーチ"] = df_posts["リーチ"].astype(str).str.replace(",", "")
df_posts["リーチ"] = pd.to_numeric(df_posts["リーチ"], errors='coerce')

df_posts = df_posts.dropna(subset=['リーチ']).copy()
df_posts.loc[:, 'リーチ'] = df_posts['リーチ'].astype(int)

# Streamlit 表示部分
dairy_sum = df_posts.groupby("実行日")["リーチ"].sum().reset_index()

fig2, ax2 = plt.subplots(figsize=(10, 5))
ax2.plot(dairy_sum["実行日"], dairy_sum["リーチ"], marker='o', linestyle='-')
ax2.set_title("日ごとの合計リーチ数")
ax2.set_xlabel("日付")
ax2.set_ylabel("合計リーチ数")
ax2.grid(True)
plt.xticks(rotation=45)
plt.tight_layout()

st.pyplot(fig2)




st.header("③ ある投稿IDについて日ごとのリーチ数を可視化")

target_id = '18038593490608586'
df_target = df_posts[df_posts['投稿ID'] == target_id].copy()
df_target['リーチ'] = pd.to_numeric(df_target['リーチ'], errors='coerce')
df_target = df_target.dropna(subset=['リーチ'])

daily_reach = df_target.groupby('実行日')['リーチ'].sum().reset_index()

fig3, ax3 = plt.subplots(figsize=(10, 5))
ax3.plot(daily_reach['実行日'], daily_reach['リーチ'], marker='o')
ax3.set_title(f"投稿ID {target_id} の日別リーチ数")
ax3.set_xlabel("実行日")
ax3.set_ylabel("リーチ数")
ax3.grid(True)
ax3.yaxis.set_major_formatter(ticker.FuncFormatter(lambda x, _: f"{int(x):,}"))
plt.xticks(rotation=45)
plt.tight_layout()
st.pyplot(fig3)




st.header("④ 各投稿ごとに日ごとの差分を集計して日ごとをKPIを集計") 

df_posts["実行日時"] = pd.to_datetime(df_posts["実行日時"]) # 日時をDateTime型に変換
df_posts["実行日"] = df_posts["実行日時"].dt.date # 日付をDateTime型に変換

kpi_cols = ['再生回数', 'リーチ', '保存数', 'いいね数', 'コメント数', 'シェア数'] # 差分を取りたい KPI 列だけ定義

for col in kpi_cols:
    df_posts[col] = ( df_posts[col] #[col]にkpi_colsのやつらを順番に代入
                     .astype(str)
                     .str.replace(",", "")
                     .pipe(pd.to_numeric, errors='coerce') )
    
df_posts = df_posts.sort_values(by=["投稿ID", "実行日時"]) # 投稿ID → 実行日時の順で並び替え

for col in kpi_cols:
    df_posts[f"{col}_増減"] = df_posts.groupby("投稿ID")[col].diff().fillna(0) # 投稿IDごとに差分を計算

daily_per_post = (
    df_posts
    .groupby(["投稿ID", "実行日"])[[f"{col}_増減" for col in kpi_cols]]
    .sum()
    .reset_index()
)

st.subheader("日ごとのKPI合計増減サマリ")
st.dataframe(daily_per_post)


