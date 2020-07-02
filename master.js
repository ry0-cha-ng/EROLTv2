// POSTリクエストを受け取るLINE Messaging APIを指定する
var CHANNEL_ACCESS_TOKEN = '<LINE Messaging APIのアクセストークン>'; 
var line_endpoint = 'https://api.line.me/v2/bot/message/reply';

// EROLT用spreadsheetへアクセスする
var ss_url = '<管理用スプレッドシートのURL>';
var spreadsheet = SpreadsheetApp.openByUrl(ss_url);
var live_datasheet = spreadsheet.getSheetByName('ライブ情報');
var reserve_datasheet = spreadsheet.getSheetByName('予約状況一覧');
var artists_datasheet = spreadsheet.getSheetByName('出演者情報一覧');

// ユーザー情報（ユーザーID、ユーザー名）を取得する
function getUsername(userId) {
  var url = 'https://api.line.me/v2/bot/profile/' + userId;
  var response = UrlFetchApp.fetch(url, {
    'headers': {
      'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN
    }
  });
  return JSON.parse(response.getContentText()).displayName;
}

// ---------------------------------------------------↓一連の流れ↓---------------------------------------------------
function doPost(e) {
  var json = JSON.parse(e.postData.contents);
  var userId = json.events[0].source.userId;
  
  //返信するためのトークン取得
  var reply_token= json.events[0].replyToken;
  if (typeof reply_token === 'undefined') {
    return;
  }
  
  // 送られたLINEメッセージを取得---------------------------------------------------
  var user_message = json.events[0].message.text;
  // 送られたLINEメッセージを空白で区切ってコマンド配列にする。（例）[登録,ST1,コミネリ,1]
  var command = user_message.split(' '); 

  // spreadsheetに追加するものを定義する（登録日時、出演者ID、予約者名、枚数、支払い料金）---------------------------------------------------
  var today = new Date();
  var reserver_name = String(command[1]);
  var artists_id = String(command[2]);
  var ticket_num = String(command[3]);
  var drink_num = String(command[4]);
  var ticket_payment = live_datasheet.getRange("B1").getValue();
  
  // 合計支払い金額を定義する
  // var drink_payment = (drink_num * 500) + 100;
  var drink_payment;
  if (ticket_num == 1) {
    // チケット枚数が1の時
    drink_payment = (drink_num * 500) + 100;

  } else {
    // チケット枚数が2以上のとき
    var more_drink_num = drink_num - ticket_num;
    drink_payment = (ticket_num * 600) + (more_drink_num * 500);
  }
  
  var total_payment = (ticket_payment * ticket_num) + drink_payment;
  
  // お客様IDに関する変数を定義する---------------------------------------------------
  var last_row = reserve_datasheet.getLastRow();
  var row_num = last_row + 1;
  var reserve_id = 'S' + row_num;
  
  // 出演者IDを出演者名に変換する---------------------------------------------------
  // (artists_datasheetのA列の値（=出演者ID）と予約者が入力したartists_idが一致したとき、artists_datasheetのB列の値（出演者）に変換する。)
  var artists_datasheet_last_row = artists_datasheet.getLastRow();
  var artists_datasheet_artists_id_col = "A";
  var artists_datasheet_artists_mane_col = "B";  
  var artists_id_range = artists_datasheet.getRange(artists_datasheet_artists_id_col + "1:" + artists_datasheet_artists_id_col + artists_datasheet_last_row);       // 出演者IDの1行目から最終行を選択する
  var artists_id_values = artists_id_range.getValues();                                                     // 値をすべて取得する
  var artists_id_array = [];                                                                                  // 配列の入れ物を用意する
  for(var k = 0; k < artists_id_values.length; k++){                                                          // 値の数だけ以下を繰り返す
    artists_id_array.push(artists_id_values[k][0]);                                                         // arrayに一つずつ値を入れる
  }
  var artists_id_row = artists_id_array.indexOf(artists_id) + 1;                                              // 配列の中から出演者IDを検索して、出演者IDが記載されている行番号を取得

  // indexOfメソッドの不都合（検索に引っかからないとき-1を返す→artists_id_row=0となる→スプレッドシートのE0を検索してしまいエラーになる）を回避するため、いったん分岐
  if (artists_id_row != 0){
    // 出演者IDがあった場合、artists_id_rowはその項目が合致した配列のインデックス番号になる
    var artists_name = artists_datasheet.getRange(artists_datasheet_artists_mane_col + artists_id_row).getDisplayValue();   // 出演者名を取得
  
  } else {
    // それ以外(入力された出演者IDが存在しない場合)
    var artists_name = 0
  }
  
  // 予約登録の際、userIdが重複していないかチェックする---------------------------------------------------
  var artists_name_col = "B";
  var reserver_name_col = "C";
  var ticket_num_col = "D";
  var drink_num_col = "E";
  var reserve_id_col = "F";
  var payment_col = "H";
  var userId_col = "I";
  var ticket_payment_col = "K";
  var drink_payment_col = "L";
  var userId_range = reserve_datasheet.getRange(userId_col + "1:" + userId_col + last_row);
  var userId_values = userId_range.getValues();
  var userId_array = [];
  for(var n = 0; n < userId_values.length; n++){
    userId_array.push(userId_values[n][0]);
  }
  var userId_row = userId_array.indexOf(userId) + 1 // 配列の中から予約者名を検索して、予約者名が記載されている行番号を取得
  
  // indexOfメソッドの不都合（検索に引っかからないとき-1を返す→userId_row=0となる→スプレッドシートのH0を検索してしまいエラーになる）を回避するため、いったん分岐
  if (userId_row != 0){
    // 予約者名がすでに存在する場合、userId_rowはその項目が合致した配列のインデックス番号になる
    var userId_checked_values = reserve_datasheet.getRange(userId_col + userId_row).getDisplayValue();   // セルに入力されているuserIdの値を表示する
    var artists_name_checked = reserve_datasheet.getRange(artists_name_col + userId_row).getDisplayValue();   // 出演者名を取得
    var reserver_name_checked = reserve_datasheet.getRange(reserver_name_col + userId_row).getDisplayValue();   // 予約者名を取得
    var ticket_num_checked = reserve_datasheet.getRange(ticket_num_col + userId_row).getDisplayValue();   // チケット予約枚数を取得
    var drink_num_col_checked = reserve_datasheet.getRange(drink_num_col + userId_row).getDisplayValue();   // ドリンク注文数を取得
    var reserve_id_checked = reserve_datasheet.getRange(reserve_id_col + userId_row).getDisplayValue();   // お客様IDを取得
    var payment_checked = reserve_datasheet.getRange(payment_col + userId_row).getDisplayValue();   // 合計支払い金額を取得
    var ticket_payment_checked = reserve_datasheet.getRange(ticket_payment_col + userId_row).getDisplayValue();   // チケット支払い金額を取得
    var drink_payment_checked = reserve_datasheet.getRange(drink_payment_col + userId_row).getDisplayValue();   // ドリンク支払い金額を取得
    
  } else {
    // それ以外(予約者名が無い場合)
    var userId_checked_values = 0
  }
  
  // 予約確認に関する返信内容作成---------------------------------------------------
  var reply_check_reserve;
  if (userId == userId_checked_values) {
    // 予約済みの方が「予約確認」をタップした場合
    reply_check_reserve = [ 'お客様の予約情報はこちらです。\n\n----------\n【取り置き先出演者名】\n' + artists_name_checked + '\n\n【お客様名】\n' + reserver_name_checked + ' 様\n\n【チケット予約枚数】\n' + ticket_num_checked + ' 枚\n\n【ドリンク注文数】\n' + drink_num_col_checked + ' 杯\n\n【お客様ID】\n' + reserve_id_checked + '\n\n【お支払い金額】\n' + payment_checked + ' 円\n・チケット代：' + ticket_payment_checked + ' 円\n・ドリンク代：' + drink_payment_checked + ' 円'];

  } else {
    //　userIdが一致しないから予約確認メッセージが来たらエラーメッセージを返す
    reply_check_reserve = ['お客様はまだご予約されて\nいないようです。\n下記メニューよりご予約を\nお願いします。'];
  }
  
  // キャンセル時に使用する変数を定義---------------------------------------------------
  var cancel_reserve_id = String(command[2]);
  var reserve_type_col = "G";
  
  //返信する内容を作成---------------------------------------------------
  var reply_messages;
  // コマンドを識別し、返事をする
  if (String(command[0]) == '登録' && userId_checked_values != 0) {
    // commandの先頭（command[0]）が「登録」で、予約者IDがすでに存在する場合→登録済みメッセージを返信する
    reply_messages = [ 'お客様は既にご登録されているようです。\nご予約状況を確認したい場合は\n下記メニューの「予約確認」を\nタップしてください。' ];

  } else if (String(command[0]) == '登録' && artists_name == 0) {
    // commandの先頭（command[0]）が「登録」で、出演者IDが存在しなかった（対応する出演者名が見つからなかった）場合→出演者ID間違えてませんかメッセージを返信する
    reply_messages = [ '申し訳ございません。\n出演者IDが間違っているようです。\n出演者IDをご確認の上、再度\nご登録をお願いします。' ];
    
  } else if (String(command[0]) == '登録' && artists_name != 0 && ticket_num > 2) {
    // commandの先頭（command[0]）が「登録」で、チケット予約枚数が2枚より多かった場合→2枚までですメッセージを返信する
    reply_messages = [ '申し訳ございません。\nチケットのご予約はおひとり様\n【2枚】までとなっております。\n予約枚数をご確認の上、再度\nご登録をお願いします。' ];

  } else if (String(command[0]) == '登録' && drink_num == "undefined") {
    // commandの先頭（command[0]）が「登録」で、ドリンク注文数の入力を忘れていた場合→ドリンク注文数も書いてよメッセージを返信する
    reply_messages = [ '申し訳ございません。\n【ドリンク注文数】の記入が\n無いようです。\n記入例をご確認の上、再度\nご登録をお願いします。' ];

  } else if (String(command[0]) == '登録' && drink_num > 9) {
    // commandの先頭（command[0]）が「登録」で、ドリンク注文数が9杯より多かった場合→9杯までですメッセージを返信する
    reply_messages = [ '申し訳ございません。\nドリンクのご予約はおひとり様\n【9杯】までとなっております。\n注文数をご確認の上、再度\nご登録をお願いします。' ];

  } else if (String(command[0]) == '登録' && ticket_num > drink_num) {
    // commandの先頭（command[0]）が「登録」で、ドリンク注文数がチケット枚数より少ない場合→1チケットにつき1杯以上のご注文をお願いしてますメッセージを返信する
    reply_messages = [ '申し訳ございません。\nドリンクは【チケット1枚につき1杯以上】ご注文いただくよう、お願いしております。\nドリンク注文数をご確認の上、再度\nご登録をお願いします。' ];
    
  } else if (String(command[0]) == '登録' && artists_name != 0 && userId_checked_values == 0) {
    // commandの先頭（command[0]）が「登録」で、予約者IDが存在しない（新規登録）場合→スプレッドシートに「登録日時」「出演者名」「予約者名（カタカナ）」「チケット予約枚数」「ドリンク注文数」「お客様ID」「予約種別（通常）」「チケット金額」「ドリンク金額」「合計支払い金額」「お客様ID」を記入する
    reserve_datasheet.appendRow([today, artists_name, reserver_name, ticket_num, drink_num, reserve_id, "通常", total_payment, userId, reserve_id, (ticket_payment * ticket_num), drink_payment]);
    reply_messages = [ '予約が完了しました。\n\n----------\n【取り置き先出演者名】\n' + artists_name + '\n\n【お客様名】\n' + reserver_name + ' 様\n\n【チケット予約枚数】\n' + ticket_num + ' 枚\n\n【ドリンク注文数】\n' + drink_num + ' 杯\n\n【お客様ID】\n' + reserve_id + '\n\n【お支払い金額】\n' + total_payment + ' 円\n・チケット代：' + (ticket_payment * ticket_num) + ' 円\n・ドリンク代：' + drink_payment + ' 円' ];

  } else if (String(command[0]) == 'キャンセル' && userId_checked_values == 0) {
    // commandの先頭（command[0]）が「キャンセル」で、予約者IDが存在しなかった（= キャンセルする予約情報がない）場合→未登録ですメッセージを返信する
    reply_messages = [ 'お客様による予約登録は行われておりません。\nチケット予約をご希望の場合は\n下記メニューの「予約登録」を\nタップしてください。' ];
    
  } else if (String(command[0]) == 'キャンセル' && userId_checked_values != 0 && reserver_name_checked != reserver_name) {
    // commandの先頭（command[0]）が「キャンセル」で、予約者IDは一致したが、予約者名が一致しない場合→予約者名間違ってますメッセージを返信する
    reply_messages = [ '予約者名が一致しませんでした。\n予約登録時にご入力いただいた\n予約者名をご確認の上、再度\nご入力をお願いします。' ];

  } else if (String(command[0]) == 'キャンセル' && userId_checked_values != 0 && reserver_name_checked == reserver_name && reserve_id_checked != cancel_reserve_id) {
    // commandの先頭（command[0]）が「キャンセル」で、予約者IDと予約者名が一致したが、お客様IDが一致しない場合→お客様ID間違ってますメッセージを返信する
    reply_messages = [ 'お客様IDが一致しませんでした。\n予約登録時に付与されたお客様IDをご確認の上、再度ご入力をお願いします。' ];
    
  } else if (String(command[0]) == 'キャンセル' && userId_checked_values != 0 && reserver_name_checked == reserver_name && reserve_id_checked == cancel_reserve_id) {
    // commandの先頭（command[0]）が「キャンセル」で、予約者ID、予約者名、お客様IDが一致した場合→「予約種別」をキャンセルに変更し、その旨返信する
    var rewrite_type_cell = reserve_datasheet.getRange(reserve_type_col + userId_row);
    rewrite_type_cell.setValue("キャンセル");
    var rewrite_id_cell = reserve_datasheet.getRange(userId_col + userId_row);
    rewrite_id_cell.setValue("キャンセル");
    reply_messages = [ 'キャンセル登録しました。\n　\nお客様名：' + reserver_name + ' 様\n　\nご利用ありがとうございました。'];

  } else if ('予約登録' == user_message) {
    // メッセージが「同意します」と一致したとき、「予約登録」メッセージを返す。
    reply_messages = [ '予約登録を行います。\n\n【お客様名（カタカナ）】\n【取り置き先出演者ID】\n【チケット予約枚数】\n【ドリンク注文数】\nを教えてください。\n\n（例）登録 コミネリ 001 1 1'];

  } else if ('予約キャンセル' == user_message) {
    // メッセージが「予約キャンセル」と一致したとき、「予約キャンセル」メッセージを返す。
    reply_messages = [ user_message + 'を行います。\n\nご予約の際にご入力いただいた\n【お客様名（カタカナ）】、\nまたその際に付与された\n【お客様ID】を教えてください。\n\n（例）キャンセル コミネリ A1\n\n※複数枚予約された中の一部のみ\nキャンセルされる場合\n→お手数ですが一度全ての登録を\nキャンセルした後、再度登録をお願いします。'];
    
  } else if ('予約確認' == user_message) {
    // メッセージが「予約確認」と一致したとき、「予約確認」メッセージを返す。
    reply_messages = reply_check_reserve;
    
  } else {
    //　それ以外のメッセージが来たらエラーメッセージを返す
    reply_messages = ['データが正しく入力されませんでした。\n記入例を参考にもう一度入力してください。\n\n初めから入力をやり直す場合は\n下記メニューからご希望の操作を\nお選びください。'];
  }

  // メッセージを返信
  var messages = reply_messages.map(function (v) {
    return {'type': 'text', 'text': v};    
  });    
  UrlFetchApp.fetch(line_endpoint, {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN,
    },
    'method': 'post',
    'payload': JSON.stringify({
      'replyToken': reply_token,
      'messages': messages,
    }),
  });
  return ContentService.createTextOutput(JSON.stringify({'content': 'post ok'})).setMimeType(ContentService.MimeType.JSON);
}