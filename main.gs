function basicInfo() {
  return {
    access_token: "EAAHgRa5hROQBOx41TqAUfIlvlfVRLbVs4S02QCmt1QZCmiFYAVWIZCJI8PKNk0KKHLKyuP0rKg9sotGdJElH0ZAZAZC9RMZCyjvG6BosOD0YI2LACGcl7U9Iuqm59DVdxmpp9fkkgeJUbLNBlATWQwzEdadUVZBrZCAbSiqlVdKDLDrGWbZBd9k9YMqSUaXWxJztF" ,
    instagram_account_id:'17841454336616282',
    version: "v21.0",
    endpoint_base: "https://graph.facebook.com/v21.0/"
  };
}

function instaApiCall(url, params, requestType) {
  var options = {
    method: requestType,
    muteHttpExceptions: true
  };

  if (requestType === "POST") {
    options.payload = params;
  } else {
    url += "?" + Object.keys(params).map(function (key) {
      return encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
    }).join("&");
  }

  var response = UrlFetchApp.fetch(url, options);
  var jsonResponse = JSON.parse(response.getContentText());

  return {
    url: url,
    endpoint_params: params,
    json_data: jsonResponse
  };
}

/**
 * Instagramアカウントの全投稿IDを取得する（ページング対応）
 */
function getAllUserMedia() {
  var config = basicInfo();
  var url = config.endpoint_base + config.instagram_account_id + "/media";
  var params = {
    fields: "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username",
    access_token: config.access_token,
    limit: 100 // 取得件数を増やす
  };

  var allPosts = [];
  var page = 1; // ページ数カウント用

  while (url) {
    Logger.log("現在のリクエストURL（ページ " + page + "）: " + url);
    
    var response = instaApiCall(url, params, "GET");
    var data = response.json_data;

    Logger.log("APIレスポンス: " + JSON.stringify(data, null, 2)); // 🔍 デバッグ用

    if (!data || !data.data) {
      Logger.log("投稿データが見つかりません");
      break;
    }

    // 投稿データを追加
    allPosts = allPosts.concat(data.data);
    Logger.log("現在の取得投稿数: " + allPosts.length);

    // 次のページがあるか確認
    if (data.paging && data.paging.next) {
      Logger.log("次のページのURL (paging.next): " + data.paging.next);

      // `after` を直接パラメータとして設定（修正点）
      if (data.paging.cursors && data.paging.cursors.after) {
        params.after = data.paging.cursors.after;
      } else {
        url = null; // 次のページがない場合は終了
      }
    } else {
      url = null;
    }

    page++;
  }

  Logger.log("最終的な取得投稿数: " + allPosts.length);
  return allPosts;
}

  // var allPosts = [];
  
  // while (url) {
  //   var response = instaApiCall(url, params, "GET");
  //   var data = response.json_data;

  //   if (!data || !data.data) {
  //     Logger.log("投稿データが見つかりません");
  //     break;
  //   }

  //   // 投稿データを追加
  //   allPosts = allPosts.concat(data.data);

  //   // 次のページがあるか確認
  //   url = data.paging && data.paging.next ? data.paging.next : null;
  //   params = {}; // `next` のURLにはパラメータが含まれているため、params をリセット
  // }

  // return allPosts;


/**
 * 各投稿のインサイトデータを取得する
 */
function getPostInsights(media_id, media_type) {
  var config = basicInfo();
  var url = `${config.endpoint_base}${media_id}/insights`;

  console.log(media_type)
  if (media_type == "VIDEO") {
    var params = {
      metric: "views,reach,saved,likes,comments,shares",
      period: "day",
      access_token: config.access_token
    }
  }

  else {
  var params = {
    metric: "reach,saved,likes,comments,shares",
    period: "day",
    access_token: config.access_token
  };
  }
  var response = instaApiCall(url, params, "GET");
  console.log(response)
  return response.json_data.data || [];
}


/**
 * すべての投稿のインサイトを取得し、スプレッドシートに書き込む
 */
function main() {
  var posts = getAllUserMedia();
  
  if (!posts || posts.length === 0) {
    Logger.log("投稿データがありません");
    return;
  }

  var sheet = getSheet();
  // sheet.clear(); // シートをクリア（既存データ削除）

  // すでにヘッダー行があるか確認（なければ追加）
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["実行日時", "投稿ID", "投稿日時", "リーチ", "保存数", "いいね数", "コメント数", "シェア数"]);
  }
  // var executionTime = new Date(); // 実行日時
  var executionTime = new Date(); // 実行日時
  var timeZone = Session.getScriptTimeZone(); // スクリプトのタイムゾーンを取得
  var formattedTime = Utilities.formatDate(executionTime, timeZone, "yyyy-MM-dd HH:mm");

  var insightData = [];

  Logger.log("\n---------- " + posts[0].username + " の投稿内容とインサイト ----------\n");

  posts.forEach(function (post, index) {
    Logger.log("\n---------- 投稿 (" + (index + 1) + ") ----------\n");
    // Logger.log("投稿日: " + post.timestamp);
    // Logger.log("投稿メディアID: " + post.id);
    // Logger.log("メディア種別: " + post.media_type);
    // Logger.log("投稿リンク: " + post.permalink);
    // Logger.log("\n投稿文: " + (post.caption || "なし"));

    // 各投稿のインサイトを取得
    var insights = getPostInsights(post.id, post.media_type);
    var insightsMap = {};

    insights.forEach(function (insight) {
      insightsMap[insight.name] = insight.values[0].value;
    });

    Logger.log("リーチ: " + formatNumber(insightsMap["reach"] || 0));
    Logger.log("保存数: " + formatNumber(insightsMap["saved"] || 0));
    Logger.log("いいね数: " + formatNumber(insightsMap["likes"] || 0));
    Logger.log("コメント数: " + formatNumber(insightsMap["comments"] || 0));
    Logger.log("シェア数: " + formatNumber(insightsMap["shares"] || 0));

    try{
      video_views = insightsMap["views"];
      }catch(e){o_
      video_views = "";
    }

    // データを保存
    var rowData = [
      formattedTime, // 実行日時
      String(post.id), // 投稿ID
      post.timestamp, // 投稿日時
      post.media_type, //media type
      video_views,
      formatNumber(insightsMap["reach"] || 0), // リーチ
      formatNumber(insightsMap["saved"] || 0), // 保存数
      formatNumber(insightsMap["likes"] || 0), // いいね数
      formatNumber(insightsMap["comments"] || 0), // コメント数
      formatNumber(insightsMap["shares"] || 0) // シェア数
    ];
    insightData.push(rowData);
  });

  // スプレッドシートにデータを書き込む
  writeToSheet(sheet, insightData);

  Logger.log("\n----- すべてのインサイトデータ取得完了 -----\n");
  Logger.log(insightData);
}

/**
 * スプレッドシートを取得
 */
function getSheet() {
  var sheetId = "1BsKRtekXQYpNxjdivZFiHJ0pNirddWNGQUO0kZpsig0"; // スプレッドシートのID
  var sheetName = "インサイト情報"; // シート名（変更可）
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName); // シートがなければ作成
  }
  return sheet;
}

/**
 * スプレッドシートにデータを書き込む
 */
function writeToSheet(sheet, data) {
  if (data.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, data.length, data[0].length).setValues(data);
  }
}

/**
 * 数値をカンマ区切りの文字列に変換
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}




























// function basicInfo() {
//   return {
//     access_token: "EAAHgRa5hROQBOx41TqAUfIlvlfVRLbVs4S02QCmt1QZCmiFYAVWIZCJI8PKNk0KKHLKyuP0rKg9sotGdJElH0ZAZAZC9RMZCyjvG6BosOD0YI2LACGcl7U9Iuqm59DVdxmpp9fkkgeJUbLNBlATWQwzEdadUVZBrZCAbSiqlVdKDLDrGWbZBd9k9YMqSUaXWxJztF" ,
//     instagram_account_id:'17841454336616282',
//     version: "v21.0",
//     endpoint_base: "https://graph.facebook.com/v21.0/"
//   };
// }

// //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// function formatDateConsistent(date) {
//   if (!(date instanceof Date)) {
//     date = new Date(date);
//   }
//   return Utilities.formatDate(date, "America/Denver", "dd/MM/yyyy, hh:mm a");
// }


// function convertToUtahTime(utcDateStr) {
//   var utcDate = new Date(utcDateStr);
//   return formatDateConsistent(utcDate);
// }

// /**
//  * 指定したDateオブジェクトを "DD/MM/YYYY, HH:MM AM/PM" 形式に変換する関数
//  */

// // function formatDate(date) {
// //   // America/Denver のタイムゾーンで時刻を取得するため、一度ローカル文字列に変換
// //   var options = { timeZone: "America/Denver" };
// //   var d = new Date(date.toLocaleString("en-US", options));
  
// //   // 日付部分
// //   var month = ("0" + (d.getMonth() + 1)).slice(-2);
// //   var day = ("0" + d.getDate()).slice(-2);
// //   var year = d.getFullYear();
  
// //   // 時刻部分（秒は無視）
// //   var hours = d.getHours();
// //   var minutes = ("0" + d.getMinutes()).slice(-2);
// //   var ampm = hours >= 12 ? "PM" : "AM";
// //   hours = hours % 12;
// //   if (hours === 0) hours = 12;
// //   hours = ("0" + hours).slice(-2);
  
// //   return day + "/" + month + "/" + year + ", " + hours + ":" + minutes + " " + ampm;
// // }

// // function formatDate(date) {
// //   var options = {
// //     timeZone: "America/Denver",
// //     day: "2-digit",
// //     month: "2-digit",
// //     year: "numeric",
// //     hour: "2-digit",
// //     minute: "2-digit",
// //     hour12: true
// //   };
// //   var formatted = date.toLocaleString("en-GB", options); // "en-GB" を指定すると日付は DD/MM/YYYY 形式になる
// //   return formatted.replace(/\b(a\.m\.|am)\b/gi, "AM")
// //                   .replace(/\b(p\.m\.|pm)\b/gi, "PM");   // 小文字のam/pmを大文字に変換
// // }

// /**
//  * UTCの日時をUtah時間（MST）に変換
//  */
// // function convertToUtahTime(utcDateStr) {
// //   var utcDate = new Date(utcDateStr); // UTC日時をJavaScriptのDateオブジェクトに変換
// //   var isDaylightSaving = isUtahDaylightSaving(utcDate);
// //   var offset = isDaylightSaving ? -6 : -7; // Utahは夏時間（MDT: UTC-6）と標準時間（MST: UTC-7）があるため、自動判定
// //   var utahTime = new Date(utcDate.getTime() + offset * 60 * 60 * 1000);// UTC時間をUtah時間に変換
// //   return formatDate(utahTime);
// // }

// // /**
// //  * Utahが夏時間（Daylight Saving Time: DST）かどうか判定
// //  */
// // function isUtahDaylightSaving(date) {
// //   var year = date.getFullYear();
// //   var startDST = new Date(year, 2, 8, 2, 0, 0); // 3月第2日曜午前2時（DST開始）
// //   var endDST = new Date(year, 10, 1, 2, 0, 0); // 11月第1日曜午前2時（DST終了）
// //   startDST.setDate(8 - startDST.getDay()); // 3月第2日曜を計算
// //   endDST.setDate(1 - endDST.getDay()); // 11月第1日曜を計算
// //   return date >= startDST && date < endDST; // DST期間内ならtrue（UTC-6）、それ以外はfalse（UTC-7）
// // }
// //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


// function instaApiCall(url, params, requestType) {
//   var options = {
//     method: requestType,
//     muteHttpExceptions: true
//   };

//   if (requestType === "POST") {
//     options.payload = params;
//   } else {
//     url += "?" + Object.keys(params).map(function (key) {
//       return encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
//     }).join("&");
//   }

//   var response = UrlFetchApp.fetch(url, options);
//   var jsonResponse = JSON.parse(response.getContentText());

//   return {
//     url: url,
//     endpoint_params: params,
//     json_data: jsonResponse
//   };
// }

// /**
//  * Instagramアカウントの全投稿IDを取得する（ページング対応）
//  */
// function getAllUserMedia() {
//   var config = basicInfo();
//   var url = config.endpoint_base + config.instagram_account_id + "/media";
//   var params = {
//     fields: "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username",
//     access_token: config.access_token,
//     limit: 100 // 取得件数を増やす
//   };

//   var allPosts = [];
//   var page = 1; // ページ数カウント用

//   while (url) {
//     Logger.log("現在のリクエストURL（ページ " + page + "）: " + url);
    
//     var response = instaApiCall(url, params, "GET");
//     var data = response.json_data;

//     Logger.log("APIレスポンス: " + JSON.stringify(data, null, 2)); // 🔍 デバッグ用

//     if (!data || !data.data) {
//       Logger.log("投稿データが見つかりません");
//       break;
//     }

//     // 投稿データを追加
//     allPosts = allPosts.concat(data.data);
//     Logger.log("現在の取得投稿数: " + allPosts.length);

//     // 次のページがあるか確認
//     if (data.paging && data.paging.next) {
//       Logger.log("次のページのURL (paging.next): " + data.paging.next);

//       // `after` を直接パラメータとして設定（修正点）
//       if (data.paging.cursors && data.paging.cursors.after) {
//         params.after = data.paging.cursors.after;
//       } else {
//         url = null; // 次のページがない場合は終了
//       }
//     } else {
//       url = null;
//     }

//     page++;
//   }

//   Logger.log("最終的な取得投稿数: " + allPosts.length);
//   return allPosts;
// }

// /**
//  * 各投稿のインサイトデータを取得する
//  */
// function getPostInsights(media_id) {
//   var config = basicInfo();
//   var url = `${config.endpoint_base}${media_id}/insights`;
//   var params = {
//     metric: "reach,saved,likes,comments,shares",
//     period: "day",
//     access_token: config.access_token
//   };

//   var response = instaApiCall(url, params, "GET");
//   return response.json_data.data || [];
// }

// /**
//  * すべての投稿のインサイトを取得し、スプレッドシートに書き込む
//  */
// function main() {
//   var posts = getAllUserMedia();

//   if (!posts || posts.length === 0) {
//     Logger.log("投稿データがありません");
//     return;
//   }

//   var sheet = getSheet();
//   sheet.clear(); // シートをクリア（既存データ削除）

//   // ヘッダー行を追加
//   sheet.appendRow(["実行日時", "投稿ID", "投稿日時", "リーチ", "保存数", "いいね数", "コメント数", "シェア数"]);

//   var executionTime = formatDateConsistent(new Date());

//   var insightData = [];

//   Logger.log("\n---------- " + posts[0].username + " の投稿内容とインサイト ----------\n");

//   posts.forEach(function (post, index) {
//     //Logger.log("post.timestamp: " + post.timestamp);  // ここでタイムスタンプを確認
//     var utahTime = formatDateConsistent(post.timestamp); // UTC → Utah時間に変換

//     Logger.log("\n---------- 投稿 (" + (index + 1) + ") ----------\n");
//     Logger.log("投稿日(UT): " + post.timestamp);
//     Logger.log("投稿メディアID: " + post.id);
//     Logger.log("メディア種別: " + post.media_type);
//     Logger.log("投稿リンク: " + post.permalink);
//     Logger.log("\n投稿文: " + (post.caption || "なし"));

//     // 各投稿のインサイトを取得
//     var insights = getPostInsights(post.id);
//     var insightsMap = {};

//     insights.forEach(function (insight) {
//       insightsMap[insight.name] = insight.values[0].value;
//     });

//     Logger.log("リーチ: " + formatNumber(insightsMap["reach"] || 0));
//     Logger.log("保存数: " + formatNumber(insightsMap["saved"] || 0));
//     Logger.log("いいね数: " + formatNumber(insightsMap["likes"] || 0));
//     Logger.log("コメント数: " + formatNumber(insightsMap["comments"] || 0));
//     Logger.log("シェア数: " + formatNumber(insightsMap["shares"] || 0));

//     // データを保存
//     var rowData = [
//       executionTime, // 実行日時
//       String(post.id), // 投稿ID
//       utahTime, // 投稿日時
//       formatNumber(insightsMap["reach"] || 0), // リーチ
//       formatNumber(insightsMap["saved"] || 0), // 保存数
//       formatNumber(insightsMap["likes"] || 0), // いいね数
//       formatNumber(insightsMap["comments"] || 0), // コメント数
//       formatNumber(insightsMap["shares"] || 0) // シェア数
//     ];
//     insightData.push(rowData);
//   });

//   // スプレッドシートにデータを書き込む
//   writeToSheet(sheet, insightData);

//   Logger.log("\n----- すべてのインサイトデータ取得完了 -----\n");
//   Logger.log(insightData);
// }

// /**
//  * スプレッドシートを取得
//  */
// function getSheet() {
//   var sheetId = "1BsKRtekXQYpNxjdivZFiHJ0pNirddWNGQUO0kZpsig0"; // スプレッドシートのID
//   var sheetName = "Sheet1"; // シート名（変更可）
//   var ss = SpreadsheetApp.openById(sheetId);
//   var sheet = ss.getSheetByName(sheetName);
//   if (!sheet) {
//     sheet = ss.insertSheet(sheetName); // シートがなければ作成
//   }
//   return sheet;
// }

// /**
//  * スプレッドシートにデータを書き込む
//  */
// function writeToSheet(sheet, data) {
//   if (data.length > 0) {
//     sheet.getRange(sheet.getLastRow() + 1, 1, data.length, data[0].length).setValues(data);
//   }
// }

// /**
//  * 数値をカンマ区切りの文字列に変換
//  */
// function formatNumber(num) {
//   return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
// }