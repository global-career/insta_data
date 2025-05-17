function getInstagramAccountInfo() {
  var ACCESS_TOKEN = "EAAHgRa5hROQBOx41TqAUfIlvlfVRLbVs4S02QCmt1QZCmiFYAVWIZCJI8PKNk0KKHLKyuP0rKg9sotGdJElH0ZAZAZC9RMZCyjvG6BosOD0YI2LACGcl7U9Iuqm59DVdxmpp9fkkgeJUbLNBlATWQwzEdadUVZBrZCAbSiqlVdKDLDrGWbZBd9k9YMqSUaXWxJztF"; // 取得したアクセストークン
  var INSTAGRAM_ACCOUNT_ID = "17841454336616282"; // Instagramアカウントの内部ID
  var SPREADSHEET_ID = "1BsKRtekXQYpNxjdivZFiHJ0pNirddWNGQUO0kZpsig0"; // スプレッドシートのID
  var SHEET_NAME = "InstagramData"; // シート名

  // APIエンドポイント
  var url = "https://graph.facebook.com/v19.0/" + INSTAGRAM_ACCOUNT_ID +
            "?fields=username,name,profile_picture_url,followers_count,media_count" +
            "&access_token=" + ACCESS_TOKEN;

  // APIリクエスト
  var response = UrlFetchApp.fetch(url, {method: "get"});
  var data = JSON.parse(response.getContentText());

  // スプレッドシートを取得
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = SpreadsheetApp.openById(SPREADSHEET_ID).insertSheet(SHEET_NAME);
  }

  // ヘッダーの設定（初回のみ）
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["取得日時", "ユーザーネーム", "名前", "フォロワー数", "投稿数", "プロフィール画像"]);
  }

  // データの書き込み
  if (!data.error) {
    var now = new Date();
    sheet.appendRow([
      now.toLocaleString(),
      data.username || "不明",
      data.name || "不明",
      data.followers_count || "不明",
      data.media_count || "不明",
      data.profile_picture_url || "不明"
    ]);
    Logger.log("データをスプレッドシートに書き込みました。");
  } else {
    Logger.log("エラー: " + data.error.message);
  }
}