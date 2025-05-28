import os
import sqlite3
import hashlib
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import streamlit as st
from google.cloud import bigquery
# streamlit-authenticator 関連のライブラリ
import streamlit_authenticator as stauth
import yaml
from yaml.loader import SafeLoader

# 認証ファイルのパスをここに指定（↓あなたのJSONファイルパス）
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "/Users/toki-mac/Downloads/extreme-core-447003-m3-88f2778773a4.json"
# BigQueryクライアント作成
client = bigquery.Client()

# SQLite DB接続
conn = sqlite3.connect('user_database.db')
c = conn.cursor()

# ログイン機能メイン
def main():
    # config.yamlの読み込み
    with open('./INSTA_DATA/config.yaml') as file:
        config = yaml.load(file, Loader=SafeLoader)
    # 認証オブジェクトの作成
    authenticator = stauth.Authenticate(
        config['credentials'],
        config['cookie']['name'],
        config['cookie']['key'],
        config['cookie']['expiry_days'],
    )

    # ログインUIの表示
    name, authentication_status, username = authenticator.login("GCC - Social Media Performance Dashboard", "main")

    if authentication_status:
        user_role = config['credentials']['usernames'][username]['role']

        # ✅ サイドバー非表示
        hide_sidebar = """
        <style>
            [data-testid="stSidebar"] {
                display: none;
            }
        </style>
        """
        st.markdown(hide_sidebar, unsafe_allow_html=True)

        # ✅ ヘッダーにログイン情報 & ログアウトボタン
        col_user, col_logout = st.columns([5, 1])
        with col_user:
            st.markdown(f"👤 ログイン中：**{name}**({user_role})")
        with col_logout:
            authenticator.logout("ログアウト", "main")

        if user_role == 'admin':
            show_dashboard(admin_mode=True)
        else:
            show_dashboard(admin_mode=False)

    elif authentication_status is False:
        st.error("ユーザー名またはパスワードが間違っています。")
    elif authentication_status is None:
        st.warning("Login to continue")

def show_dashboard(admin_mode=False):
    if admin_mode:
        st.info("🛠 管理者モードです。編集や追加機能が有効です。")
        # 管理者だけの機能を書く
    else:
        st.info("🔎 閲覧モードです。データの閲覧のみ可能です。")

    #①
    query_followers = """
    SELECT date, username, insta_name, follower, posts_count, profile_image
    FROM `extreme-core-447003-m3.test.follower`
    """
    df_followers = client.query(query_followers).to_dataframe()
    df_followers.columns = ["取得日時", "ユーザーネーム", "名前", "フォロワー数", "投稿数", "プロフィール画像"]

    df_followers["取得日時"] = (
        df_followers["取得日時"]
        .astype(str)
        .str.replace("午前", "AM")
        .str.replace("午後", "PM")
    )
    df_followers["取得日"] = pd.to_datetime(
        df_followers["取得日時"],
        format="%m/%d/%Y, %I:%M:%S %p",
        errors="coerce"
    ).dt.date


    df_daily = df_followers.groupby("取得日").last().reset_index()
    df_daily["フォロワー数"] = pd.to_numeric(df_daily["フォロワー数"], errors="coerce")
    df_daily["増減"] = df_daily["フォロワー数"].diff()
    df_daily["フラグ"] = df_daily["増減"].apply(
        lambda x: "データなし" if pd.isna(x) else ("増加" if x > 0 else ("減少" if x < 0 else "変化なし"))
    )
    #②
    query_posts = """
    SELECT date, post_id, post_date, post_type, view_count, reach, saved, `like`, `comment`, `share`
    FROM `extreme-core-447003-m3.test.insight`
    """
    df_posts = client.query(query_posts).to_dataframe()
    df_posts.columns = ["実行日時", "投稿ID", "投稿日時", "投稿種別", "再生回数", "リーチ", "保存数", "いいね数", "コメント数", "シェア数"] 
    # Clean up timestamp formatting if needed
    df_posts["実行日時"] = (
        df_posts["実行日時"]
        .astype(str)
        .str.replace("午前", "AM")
        .str.replace("午後", "PM")
    )
    # Use only the date portion
    df_posts["実行日"] = pd.to_datetime(df_posts["実行日時"].str[:10], format="%Y/%m/%d").dt.date
    # df_posts["実行日時"] = df_posts["実行日時"].str.replace(r"\d{2}:\d{2}$", "00:00", regex=True) # 実行日時から時刻部分の分を00にする（例：13:24 → 13:00）
    # df_posts["実行日"] = pd.to_datetime(df_posts["実行日時"]).dt.date # 実行日だけ取り出した列を追加（あとでグラフに使える）
    df_posts["リーチ"] = df_posts["リーチ"].astype(str).str.replace(",", "")
    df_posts = df_posts.dropna(subset=['リーチ']).copy()
    df_posts.loc[:, 'リーチ'] = df_posts['リーチ'].astype(int)
    #③
    dairy_sum = df_posts.groupby("実行日")["リーチ"].sum().reset_index()
    target_id = '18038593490608586'
    df_target = df_posts[df_posts['投稿ID'] == target_id].copy()
    df_target = df_target.dropna(subset=['リーチ'])
    daily_reach = df_target.groupby('実行日')['リーチ'].sum().reset_index()
    #④
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


    # ==== グリッド表示 ====
    colA1, colA2 = st.columns(2)
    with colA1:
        st.subheader("① フォロワー数の推移")
        st.line_chart(df_daily.set_index("取得日")["フォロワー数"])
        st.dataframe(df_daily[["取得日", "フォロワー数", "増減", "フラグ"]])

    with colA2:
        st.subheader("② 日ごとの合計リーチ数")
        fig2, ax2 = plt.subplots(figsize=(6, 4))
        ax2.plot(dairy_sum["実行日"], dairy_sum["リーチ"], marker='o', linestyle='-')
        ax2.set_xlabel("日付"); ax2.set_ylabel("リーチ数"); ax2.grid(True)
        plt.xticks(rotation=45); plt.tight_layout()
        st.pyplot(fig2)

    colB1, colB2 = st.columns(2)
    with colB1:
        st.subheader("③ 投稿別リーチ推移")
        fig3, ax3 = plt.subplots(figsize=(6, 4))
        ax3.plot(daily_reach['実行日'], daily_reach['リーチ'], marker='o')
        ax3.set_xlabel("実行日"); ax3.set_ylabel("リーチ数"); ax3.grid(True)
        ax3.set_title(f"投稿ID {target_id}")
        ax3.yaxis.set_major_formatter(ticker.FuncFormatter(lambda x, _: f"{int(x):,}"))
        plt.xticks(rotation=45); plt.tight_layout()
        st.pyplot(fig3)

    with colB2:
        st.subheader("④ KPI日次増減")
        st.dataframe(daily_per_post.drop(columns=["投稿ID"]))
    

if __name__ == '__main__':
    main()
