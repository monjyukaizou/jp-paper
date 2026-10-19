#target indesign
/*
  ブック印刷のコトセミナー チラシ 自動組版スクリプト
  ------------------------------------------------------------
  仕上がり：A4見開き4ページ（A3二つ折り）／塗り足し3mm
    p1 表紙（右）  p2-3 中面 Before / After（見開き）  p4 裏表紙（左）
  使い方：
    1. InDesign を起動（書類は開かなくてよい）
    2. ウィンドウ > ユーティリティ > スクリプト を開く
    3. 「ユーザー」フォルダを右クリック > Finder（エクスプローラー）で表示
    4. このファイルをそのフォルダに入れ、パネルでダブルクリック
    5. デスクトップに「ブック印刷のコトセミナー.indd」が保存されます
  推奨フォント（Google Fonts・無料）：
    Zen Kaku Gothic New / Yusei Magic / Klee One
    ※ 未インストールの場合は小塚ゴシック・ヒラギノで代替します
*/

var MISSING = [];
var doc, C = {}, PS = {}, CS = {}, F = {}, NONE;

function pickFont(cands) {
    for (var i = 0; i < cands.length; i++) {
        try {
            var f = app.fonts.itemByName(cands[i]);
            if (f.isValid) return f;
        } catch (e) {}
    }
    MISSING.push(cands[0].replace("\t", " "));
    return null;
}

function swatchByNames(names) {
    for (var i = 0; i < names.length; i++) {
        try {
            var s = doc.swatches.itemByName(names[i]);
            if (s.isValid) return s;
        } catch (e) {}
    }
    return doc.swatches[0];
}

function mkColor(name, cmyk) {
    return doc.colors.add({name: name, model: ColorModel.PROCESS, space: ColorSpace.CMYK, colorValue: cmyk});
}

function mkPS(name, f, size, leading, tracking, color, just, extra) {
    var p = doc.paragraphStyles.add({name: name});
    if (F[f]) { try { p.appliedFont = F[f]; } catch (e) {} }
    p.pointSize = size;
    p.leading = leading ? leading : Leading.AUTO;
    p.tracking = tracking;
    p.fillColor = C[color];
    p.justification = just;
    try { p.composer = "$ID/HL Composer J"; } catch (e) {}
    try { p.kinsokuSet = KinsokuSet.HARD_KINSOKU; } catch (e) {}
    if (extra) for (var k in extra) { try { p[k] = extra[k]; } catch (e) {} }
    PS[name] = p;
}

function mkCS(name, props) {
    var c = doc.characterStyles.add({name: name});
    for (var k in props) {
        try { c[k] = (k == "appliedFont") ? F[props[k]] : (k == "fillColor" ? C[props[k]] : props[k]); } catch (e) {}
    }
    CS[name] = c;
}

function setName(o, n) { try { o.name = n; } catch (e) { o.label = n; } }

function rounded(o, r) {
    o.topLeftCornerOption = o.topRightCornerOption = o.bottomLeftCornerOption = o.bottomRightCornerOption = CornerOptions.ROUNDED_CORNER;
    o.topLeftCornerRadius = o.topRightCornerRadius = o.bottomLeftCornerRadius = o.bottomRightCornerRadius = r;
}

// 時計回り（CSS の rotate と同じ向き）に中心で回転
function rot(o, deg) {
    try {
        o.transform(CoordinateSpaces.PASTEBOARD_COORDINATES, AnchorPoint.CENTER_ANCHOR,
            app.transformationMatrices.add({counterclockwiseRotationAngle: -deg}));
    } catch (e) { o.rotationAngle = -deg; }
}

function R(pg, b, fill, opt) {
    opt = opt || {};
    var r = pg.rectangles.add({geometricBounds: b});
    r.fillColor = fill ? fill : NONE;
    r.strokeColor = opt.stroke ? opt.stroke : NONE;
    if (opt.stroke) r.strokeWeight = opt.sw || 0.5;
    if (opt.radius) rounded(r, opt.radius);
    if (opt.name) setName(r, opt.name);
    if (opt.opacity) r.transparencySettings.blendingSettings.opacity = opt.opacity;
    return r;
}

function O(pg, b, fill, opt) {
    opt = opt || {};
    var o = pg.ovals.add({geometricBounds: b});
    o.fillColor = fill ? fill : NONE;
    o.strokeColor = opt.stroke ? opt.stroke : NONE;
    if (opt.stroke) o.strokeWeight = opt.sw || 0.5;
    if (opt.name) setName(o, opt.name);
    return o;
}

function L(pg, y1, x1, y2, x2, color, w, opt) {
    opt = opt || {};
    var l = pg.graphicLines.add();
    l.paths[0].entirePath = [[x1, y1], [x2, y2]];
    l.strokeColor = color;
    l.strokeWeight = w;
    if (opt.dotted) {
        var st = null, names = ["$ID/Dotted", "Dotted", "点線"];
        for (var i = 0; i < names.length && !st; i++) {
            try { var s = doc.strokeStyles.itemByName(names[i]); if (s.isValid) st = s; } catch (e) {}
        }
        if (st) l.strokeType = st;
    }
    if (opt.opacity) l.transparencySettings.blendingSettings.opacity = opt.opacity;
    return l;
}

// paras: [[テキスト, 段落スタイル名], ...]
function T(pg, b, paras, opt) {
    opt = opt || {};
    var tf = pg.textFrames.add({geometricBounds: b});
    tf.fillColor = opt.fill ? opt.fill : NONE;
    tf.strokeColor = opt.stroke ? opt.stroke : NONE;
    if (opt.stroke) tf.strokeWeight = opt.sw || 0.85;
    var s = [];
    for (var i = 0; i < paras.length; i++) s.push(paras[i][0]);
    tf.contents = s.join("\r");
    for (var j = 0; j < paras.length; j++) {
        tf.parentStory.paragraphs[j].appliedParagraphStyle = PS[paras[j][1]];
    }
    tf.textFramePreferences.insetSpacing = opt.inset || [0, 0, 0, 0];
    if (opt.vcenter) tf.textFramePreferences.verticalJustification = VerticalJustification.CENTER_ALIGN;
    if (opt.radius) rounded(tf, opt.radius);
    if (opt.name) setName(tf, opt.name);
    if (opt.cs) for (var k = 0; k < opt.cs.length; k++) applyCS(tf, opt.cs[k][0], opt.cs[k][1]);
    return tf;
}

function applyCS(tf, sub, csName) {
    var st = tf.parentStory, txt = st.contents, from = 0, idx;
    while ((idx = txt.indexOf(sub, from)) >= 0) {
        st.characters.itemByRange(idx, idx + sub.length - 1).appliedCharacterStyle = CS[csName];
        from = idx + sub.length;
    }
}

var BR = "\u2028"; // 強制改行

/* ====================== 共通パーツ ====================== */

// isLeft: 左ページ（塗り足しは左側）
function header(pg, isLeft, label, title) {
    var xl = isLeft ? -3 : 0, xr = isLeft ? 210 : 213;
    var right = isLeft ? 198 : 194;
    T(pg, [10, 20, 15.5, right], [[label, "見出し_ラベル"]]);
    L(pg, 16.5, xl, 16.5, xr, C["罫線"], 0.85);
    T(pg, [18.5, 10, 29, right + 2], [[title, "見出し_大"]]);
    L(pg, 30.5, xl, 30.5, xr, C["罫線"], 0.85);
}

function footer(pg, isLeft, text, bolds, pageNo) {
    var xl = isLeft ? -3 : 0, xr = isLeft ? 210 : 213, x = isLeft ? 11 : 14;
    R(pg, [281, xl, 300, xr], C["クリーム"]);
    O(pg, [283.5, x, 294.5, x + 11], C["ねこ背景"], {name: "キャラクター配置（差し替え）"});
    var cs = [];
    for (var i = 0; i < bolds.length; i++) cs.push([bolds[i], "フッター強調"]);
    T(pg, [283, x + 15, 295, isLeft ? 205 : 208], [[text, "フッター"]], {vcenter: true, cs: cs});
    if (pageNo) {
        if (isLeft) T(pg, [272, 11, 277, 40], [[pageNo, "ノンブル_左"]]);
        else T(pg, [272, 165, 277, 194], [[pageNo, "ノンブル_右"]]);
    }
}

function sticky(pg, x1, title, lead, items) {
    var b = [48, x1, 99, x1 + 58];
    var paper = R(pg, b, C["付箋"]);
    var paras = [[title, "付箋_見出し"], [lead, "付箋_数字"]];
    for (var i = 0; i < items.length; i++) paras.push([items[i], "付箋_項目"]);
    var tf = T(pg, b, paras, {inset: [4, 4.5, 3, 4.5], cs: [[lead.substr(1), "付箋_小"]]});
    var tape = R(pg, [45, x1 + 24, 51, x1 + 34], C["テープ"], {opacity: 85});
    var g = pg.groups.add([paper, tf, tape]);
    setName(g, "付箋");
    rot(g, 4);
}

function card(pg, x1, y1, x2, y2, num, title, body, after, tag) {
    R(pg, [y1, x1, y2, x2], C["白"], {radius: 2.5});
    var suf = after ? "A" : "B";
    T(pg, [y1 + 4.5, x1 + 4, y1 + 20, x1 + 21], [["その", "番号_小" + suf], [num, "番号_大" + suf]]);
    var bodyBottom = tag ? y2 - 8 : y2 - 3;
    T(pg, [y1 + (after ? 3.3 : 4.5), x1 + 26, bodyBottom, x2 - 5],
        [[title, after ? "カード_見出し" : "カード_見出しB"], [body, "カード_本文"]]);
    if (tag) T(pg, [y2 - 7.6, x1 + 26, y2 - 3.4, x1 + 53], [[tag, "タグ"]], {fill: C["オレンジ"], vcenter: true, radius: 2});
}

/* ====================== メイン ====================== */

function main() {
    doc = app.documents.add();
    var dp = doc.documentPreferences;
    dp.facingPages = true;
    dp.pageBinding = PageBindingOptions.LEFT_TO_RIGHT;
    dp.pageWidth = "210mm";
    dp.pageHeight = "297mm";
    dp.pagesPerDocument = 4;
    dp.documentBleedUniformSize = true;
    dp.documentBleedTopOffset = "3mm";
    doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.MILLIMETERS;
    doc.viewPreferences.verticalMeasurementUnits = MeasurementUnits.MILLIMETERS;
    doc.viewPreferences.rulerOrigin = RulerOrigin.PAGE_ORIGIN;
    doc.zeroPoint = [0, 0];
    for (var m = 0; m < doc.pages.length; m++) {
        doc.pages[m].marginPreferences.properties = {top: 0, bottom: 0, left: 0, right: 0};
    }
    NONE = swatchByNames(["$ID/None", "None", "なし"]);

    // ---- カラー（CMYK）----
    C["墨"] = mkColor("墨", [0, 0, 0, 90]);
    C["白"] = mkColor("白", [0, 0, 0, 0]);
    C["ブルー"] = mkColor("ブルー面", [15, 4, 0, 0]);
    C["ブルー濃"] = mkColor("注釈ブルー", [65, 40, 5, 0]);
    C["オレンジ"] = mkColor("オレンジ", [0, 72, 85, 0]);
    C["マスタード"] = mkColor("マスタード", [0, 40, 78, 0]);
    C["バイオレット"] = mkColor("バイオレット", [75, 70, 0, 0]);
    C["付箋"] = mkColor("付箋イエロー", [3, 3, 50, 0]);
    C["クリーム"] = mkColor("クリーム", [4, 5, 9, 0]);
    C["グレー"] = mkColor("グレー", [10, 5, 0, 50]);
    C["グレー濃"] = mkColor("グレー濃", [20, 10, 0, 70]);
    C["罫線"] = mkColor("罫線グレー", [0, 0, 0, 45]);
    C["茶濃"] = mkColor("茶（濃）", [50, 65, 75, 55]);
    C["茶淡"] = mkColor("茶（淡）", [20, 50, 75, 5]);
    C["テープ"] = mkColor("テープ", [30, 45, 60, 20]);
    C["ねこ背景"] = mkColor("ねこ背景", [3, 6, 40, 0]);
    C["シアン"] = mkColor("C100", [100, 0, 0, 0]);
    C["マゼンタ"] = mkColor("M100", [0, 100, 0, 0]);
    C["イエロー"] = mkColor("Y100", [0, 0, 100, 0]);

    // ---- フォント ----
    F.GR = pickFont(["Zen Kaku Gothic New\tRegular", "Kozuka Gothic Pr6N\tR", "Hiragino Kaku Gothic ProN\tW3"]);
    F.GM = pickFont(["Zen Kaku Gothic New\tMedium", "Kozuka Gothic Pr6N\tM", "Hiragino Kaku Gothic ProN\tW3"]);
    F.GB = pickFont(["Zen Kaku Gothic New\tBold", "Kozuka Gothic Pr6N\tB", "Hiragino Kaku Gothic ProN\tW6"]);
    F.GH = pickFont(["Zen Kaku Gothic New\tBlack", "Kozuka Gothic Pr6N\tH", "Hiragino Kaku Gothic StdN\tW8", "Hiragino Kaku Gothic ProN\tW6"]);
    F.BR = pickFont(["Yusei Magic\tRegular", "Kozuka Gothic Pr6N\tH", "Hiragino Kaku Gothic ProN\tW6"]);
    F.HA = pickFont(["Klee One\tSemiBold", "Klee One\tRegular", "Kozuka Mincho Pr6N\tR", "Hiragino Mincho ProN\tW3"]);

    var Lf = Justification.LEFT_ALIGN, Ce = Justification.CENTER_ALIGN, Ri = Justification.RIGHT_ALIGN, Ju = Justification.LEFT_JUSTIFIED;

    // ---- 段落スタイル ----
    mkPS("表紙_キッカー", "GH", 13, 0, 550, "マスタード", Lf);
    mkPS("表紙_タイトル1", "BR", 54, 58, 20, "墨", Lf);
    mkPS("表紙_タイトル2", "BR", 40, 44, 60, "墨", Lf);
    mkPS("表紙_スタンプ大", "HA", 10.5, 14, 0, "墨", Ce);
    mkPS("表紙_スタンプ", "HA", 8.5, 12, 0, "墨", Ce);
    mkPS("表紙_バッジ", "GH", 13, 0, 40, "白", Ce);
    mkPS("表紙_特集", "GM", 10.5, 0, 300, "白", Lf);
    mkPS("表紙_サブ", "GM", 15, 28, 200, "白", Lf);
    mkPS("表紙_吹き出し", "HA", 10.5, 18, 120, "白", Ce);
    mkPS("表紙_ラベル", "GM", 9, 0, 300, "白", Ce);
    mkPS("表紙_日時", "GM", 10.5, 15, 60, "白", Lf);
    mkPS("表紙_セミナー番号", "GM", 10, 0, 140, "白", Lf);
    mkPS("表紙_セミナー時間", "GR", 8, 0, 60, "白", Lf);
    mkPS("表紙_セミナー題", "GM", 13.5, 21, 120, "白", Lf);
    mkPS("表紙_セミナー補足", "GR", 9, 14, 40, "白", Lf, {spaceAfter: "0.8mm"});
    mkPS("表紙_小", "GB", 8.5, 0, 0, "白", Lf);
    mkPS("表紙_社名小", "GB", 8, 0, 0, "白", Ri);
    mkPS("表紙_社名", "GB", 13, 0, 300, "白", Ri);
    mkPS("表紙_注記", "GR", 7, 0, 0, "白", Ri);
    mkPS("見出し_ラベル", "GM", 11, 0, 200, "墨", Ri);
    mkPS("見出し_大", "GM", 25, 0, 220, "墨", Ri);
    mkPS("リード", "GH", 17, 27, 60, "墨", Lf);
    mkPS("付箋_見出し", "HA", 14, 0, 0, "墨", Lf);
    mkPS("付箋_数字", "HA", 34, 38, 0, "墨", Lf, {leftIndent: "2mm"});
    mkPS("付箋_項目", "HA", 8.6, 14, 0, "墨", Lf, {ruleBelow: true, ruleBelowColor: C["ブルー濃"], ruleBelowLineWeight: 0.85, ruleBelowOffset: "0.8mm"});
    mkPS("番号_小B", "HA", 9, 11, 0, "グレー", Ce);
    mkPS("番号_大B", "HA", 24, 26, 0, "グレー", Ce);
    mkPS("番号_小A", "HA", 9, 11, 0, "オレンジ", Ce);
    mkPS("番号_大A", "HA", 24, 26, 0, "オレンジ", Ce);
    mkPS("カード_見出しB", "GH", 12.5, 18, 30, "グレー濃", Lf);
    mkPS("カード_見出し", "GH", 12.5, 18, 30, "墨", Lf);
    mkPS("カード_本文", "GR", 9.6, 17, 0, "墨", Ju, {spaceBefore: "1.2mm"});
    mkPS("タグ", "GB", 8.5, 0, 60, "白", Ce);
    mkPS("注釈", "HA", 10, 15, 0, "ブルー濃", Lf);
    mkPS("フッター", "GM", 10, 0, 0, "ブルー濃", Lf);
    mkPS("ノンブル_左", "GB", 9, 0, 0, "墨", Lf);
    mkPS("ノンブル_右", "GB", 9, 0, 0, "墨", Ri);
    mkPS("Check", "GH", 30, 0, -20, "バイオレット", Lf);
    mkPS("フロー", "GH", 10.5, 15, 0, "墨", Ce);
    mkPS("フロー_ゴール", "GH", 10.5, 15, 0, "オレンジ", Ce);
    mkPS("フロー_小", "GR", 7.5, 11, 0, "グレー濃", Ce, {spaceBefore: "0.8mm"});
    mkPS("矢印", "GR", 12, 0, 0, "オレンジ", Ce);
    mkPS("裏_リード", "GH", 17, 26, 60, "墨", Lf);
    mkPS("ステップ_ラベル", "GB", 9, 0, 120, "オレンジ", Lf);
    mkPS("ステップ_見出し", "GH", 10.5, 16, 40, "墨", Lf, {spaceBefore: "0.8mm"});
    mkPS("ステップ_本文", "GR", 8.4, 13.5, 0, "墨", Lf, {spaceBefore: "0.8mm"});
    mkPS("裏_本文", "GR", 10.3, 20, 0, "墨", Ju);
    mkPS("締め", "BR", 27, 0, 60, "墨", Ce);
    mkPS("バッジ", "GB", 9, 0, 120, "白", Ce);
    mkPS("ミニ_小", "GH", 3.6, 0, 200, "マスタード", Lf);
    mkPS("ミニ_題", "BR", 8.6, 0, 0, "墨", Lf);
    mkPS("ミニ_総集編", "GB", 5, 0, 150, "白", Lf);
    mkPS("プレゼント_小", "GB", 8.5, 0, 100, "ブルー濃", Lf);
    mkPS("プレゼント_見出し", "GH", 12.5, 19, 0, "墨", Lf);
    mkPS("プレゼント_疑問", "HA", 9, 15, 0, "ブルー濃", Lf, {spaceBefore: "2mm"});
    mkPS("プレゼント_本文", "GR", 8.8, 14, 0, "墨", Lf, {spaceBefore: "1.5mm"});
    mkPS("情報_見出し", "GB", 8.5, 0, 250, "オレンジ", Lf, {spaceAfter: "0.8mm"});
    mkPS("情報_強", "GB", 10.5, 16, 0, "墨", Lf);
    mkPS("情報_本文", "GR", 8.6, 14, 0, "墨", Lf);

    // ---- 文字スタイル ----
    mkCS("オレンジ強調", {fillColor: "オレンジ"});
    mkCS("日付", {appliedFont: "GB", pointSize: 21, tracking: 60});
    mkCS("曜日", {appliedFont: "GB", pointSize: 11});
    mkCS("タイトルの", {pointSize: 30});
    mkCS("付箋_小", {pointSize: 13});
    mkCS("フッター強調", {appliedFont: "GB", pointSize: 12});
    mkCS("時刻", {appliedFont: "GR", pointSize: 7.5, fillColor: "墨", tracking: 40});
    mkCS("仮テキスト", {fillColor: "オレンジ", underline: true});

    var p1 = doc.pages[0], p2 = doc.pages[1], p3 = doc.pages[2], p4 = doc.pages[3];

    /* ================= p1 表紙 ================= */
    var photo = R(p1, [97, 0, 300, 213], C["茶濃"], {name: "表紙写真（差し替え）"});
    try {
        var gr = doc.gradients.add({name: "表紙写真の代替", type: GradientType.LINEAR});
        gr.gradientStops[0].stopColor = C["茶濃"];
        gr.gradientStops[1].stopColor = C["茶淡"];
        photo.fillColor = gr;
        photo.gradientFillAngle = -80;
    } catch (e) {}

    // 破れ紙の境界
    var pts = [[0, 92]], seed = 7;
    for (var x = 0; x <= 213; x += 5) {
        seed = (seed * 37 + 11) % 97;
        pts.push([x, 99.5 + (seed % 10) / 4]);
    }
    pts.push([213, 92]);
    var torn = p1.polygons.add();
    torn.paths[0].entirePath = pts;
    torn.fillColor = C["白"];
    torn.strokeColor = NONE;
    setName(torn, "破れ紙");

    T(p1, [17, 15, 24, 160], [["アイワード東京セミナー", "表紙_キッカー"]]);
    T(p1, [26, 13, 48, 160], [["ブック印刷", "表紙_タイトル1"]]);
    R(p1, [24, 104, 26, 106], C["シアン"]);
    R(p1, [24, 106.6, 26, 108.6], C["マゼンタ"]);
    R(p1, [24, 109.2, 26, 111.2], C["イエロー"]);
    T(p1, [50, 47, 70, 205], [["のコトセミナー", "表紙_タイトル2"]], {cs: [["の", "タイトルの"]]});
    var stamp = O(p1, [12, 164, 41, 195], null, {stroke: C["墨"], sw: 1.1});
    var stampT = T(p1, [12, 164, 41, 195], [["本づくり研究室の", "表紙_スタンプ大"], ["出張セミナー" + BR + "in TOKYO", "表紙_スタンプ"]], {vcenter: true});
    var sg = p1.groups.add([stamp, stampT]);
    rot(sg, 6);

    O(p1, [98, 13, 126, 43], C["マスタード"], {name: "バッジ"});
    T(p1, [98, 13, 126, 43], [["TOKYO", "表紙_バッジ"]], {vcenter: true});

    T(p1, [134, 15, 172, 135], [["特集", "表紙_特集"], ["編集工数を減らして" + BR + "こだわりの本づくり、" + BR + "しませんか？", "表紙_サブ"]]);

    O(p1, [123, 140, 147, 192], null, {stroke: C["白"], sw: 1.2});
    var tail = p1.polygons.add();
    tail.paths[0].entirePath = [[156, 146.2], [161, 146.6], [155, 152]];
    tail.fillColor = NONE; tail.strokeColor = C["白"]; tail.strokeWeight = 1.2;
    T(p1, [124, 142, 146, 190], [["なんだか、" + BR + "ぜんぶ聞きたいニャ", "表紙_吹き出し"]], {vcenter: true});
    T(p1, [113, 120, 118, 194], [["写真差し替え推奨（本・紙の写真）", "表紙_注記"]]);

    T(p1, [174, 15, 179.5, 28], [["日時", "表紙_ラベル"]], {stroke: C["白"], sw: 0.85, vcenter: true});
    T(p1, [171.5, 32, 181, 205], [["2026.11.26（木）　10:00〜18:00", "表紙_日時"]], {vcenter: true, cs: [["2026.11.26", "日付"], ["（木）", "曜日"]]});
    T(p1, [184, 15, 189.5, 28], [["会場", "表紙_ラベル"]], {stroke: C["白"], sw: 0.85, vcenter: true});
    T(p1, [183.5, 32, 190, 205], [["日本教育会館 703号室（東京都千代田区一ツ橋2丁目6−2）", "表紙_日時"]], {vcenter: true});

    L(p1, 199, 15, 199, 194, C["白"], 0.85, {opacity: 50});
    var sems = [
        [204, "SEMINAR #1", "10:30〜11:30", [
            ["その校正作業、まだ目で追っていませんか？", "表紙_セミナー題"],
            ["＜カタログ改版（差分検証）を機械の目でチェックします＞", "表紙_セミナー補足"],
            ["デザイナーに負担をかけていませんか？", "表紙_セミナー題"],
            ["＜その原稿、レイアウト前に直せますよ＞", "表紙_セミナー補足"]]],
        [235, "SEMINAR #2", "13:30〜14:30", [
            ["制作が大変な記念誌、受注しても大丈夫ですよ！", "表紙_セミナー題"],
            ["＜アイワードが培ったノウハウを入れ込んだAIを駆使して、システマチックに作成できます＞", "表紙_セミナー補足"]]],
        [253, "SEMINAR #3", "15:30〜16:30", [
            ["実物15冊が語る　こだわりの印刷と造本設計のすべて", "表紙_セミナー題"]]]
    ];
    for (var s = 0; s < sems.length; s++) {
        var y = sems[s][0];
        T(p1, [y + 0.8, 15, y + 11, 46], [[sems[s][1], "表紙_セミナー番号"], [sems[s][2], "表紙_セミナー時間"]]);
        T(p1, [y, 46, y + (s == 0 ? 30 : 17), 196], sems[s][3]);
    }
    T(p1, [280, 15, 285.5, 140], [["ご来場の皆さまに『ブック印刷のコト』総集編をプレゼント", "表紙_小"]]);
    L(p1, 286.2, 15, 286.2, 104, C["白"], 0.85, {dotted: true, opacity: 70});
    T(p1, [274, 140, 288, 194], [["株式会社", "表紙_社名小"], ["アイワード", "表紙_社名"]], {name: "社名（ロゴ差し替え）"});

    /* ================= p2 中面 Before ================= */
    header(p2, true, "BEFORE", "「今までの本づくり」");
    R(p2, [44, -3, 275, 210], C["ブルー"]);
    T(p2, [52, 11, 96, 136], [["今までの本づくりは、" + BR + "正確なものを作るのに" + BR + "大変な時間と労力が" + BR + "かかりました。", "リード"]],
        {cs: [["大変な時間と労力", "オレンジ強調"]]});
    sticky(p2, 140, "“大変だった”", "4つの理由",
        ["その1　目で追う校正・改訂", "その2　紙のゲラと赤字集約", "その3　膨大な資料整理", "その4　予算が本に回らない"]);
    var cb = [[104, 139], [142.5, 171.5], [175, 197.5], [201, 230]];
    var bTitles = ["目で追う校正・索引・改訂", "紙のゲラ郵送と赤字の取りまとめ", "膨大な資料に向き合う記念誌", "人件費がかさみ、本に予算が回らない"];
    var bBodies = [
        "人間が目でチェックをし、索引はアナログ的に手で拾ってマーカーをつけていました。カタログ等の改訂も、原著との差分を目で追って調べていました。中には修正していない箇所まで手を加えられ、刷り直しになることも…。",
        "著者や複数の意思決定者に紙でゲラを郵送し、編集者が集約して赤字を取りまとめていました。中には転記ミスによってトラブルになることも…。",
        "膨大な資料データを整理することになる記念誌は、仕事を始める前からすでに精神的な負担が…。",
        "大変な思いをして整理・作成したデータは、この段階ですでに人件費がかさみ、肝心の本そのものに予算を割けず、よくある見た目の本にしかなりませんでした。"];
    for (var i = 0; i < 4; i++) card(p2, 11, cb[i][0], 198, cb[i][1], String(i + 1), bTitles[i], bBodies[i], false);
    var annoT = T(p2, [258.5, 13, 265, 110], [["手間をかけたのに、仕上がりは「よくある本」…。", "注釈"]], {vcenter: true});
    var al1 = L(p2, 257.5, 13, 257.5, 110, C["ブルー濃"], 1.4, {dotted: true});
    var al2 = L(p2, 266, 13, 266, 110, C["ブルー濃"], 1.4, {dotted: true});
    rot(p2.groups.add([annoT, al1, al2]), -4);
    footer(p2, true, "本づくりは見えない手間が多い！　その手間、減らせるかもしれません", ["見えない手間", "減らせる"], "2");

    /* ================= p3 中面 After ================= */
    header(p3, false, "AFTER", "「これからの本づくり」");
    R(p3, [44, 0, 275, 213], C["ブルー"]);
    T(p3, [52, 12, 96, 139], [["人が目で追う労力は" + BR + "極力かけず、その分の費用を" + BR + "装丁などの最終成果物に" + BR + "落とし込みます。", "リード"]],
        {cs: [["その分の費用を", "オレンジ強調"], ["装丁などの最終成果物", "オレンジ強調"]]});
    sticky(p3, 143, "“ラクして良い本”", "4つの工夫",
        ["その1　索引・差分をデジタルで", "その2　赤字＝修正指示に", "その3　資料はデータベースに", "その4　浮いた予算は造本へ"]);
    var ca = [[104, 135.7], [138.7, 164.7], [167.7, 199.4], [202.4, 228.4]];
    var aTitles = ["索引は自動抽出、改版の差分もデジタルで", "赤字がそのまま修正指示に", "記念誌は、データベースで執筆の材料づくり", "浮いた予算で、目を引く造本設計を"];
    var aBodies = [
        "索引は事前にマーカーしておけば自動的に抽出。改版するカタログも、どの部分が変わっているのかデジタル上でわかります。",
        "著者への赤字伺いが確定すると、その指示をそのまま印刷会社への修正指示にすることもできます。",
        "データベースツールに一次資料を読み込ませ、文章を書く人に「執筆の材料」を提供。スムーズに書き進められます。",
        "デジタルツールで工数を減らし、その浮いた予算で、見る人の目を引く造本設計にしませんか？"];
    var aTags = ["→ SEMINAR #1", "→ SEMINAR #1", "→ SEMINAR #2", "→ SEMINAR #3"];
    for (var j = 0; j < 4; j++) card(p3, 12, ca[j][0], 197, ca[j][1], String(j + 1), aTitles[j], aBodies[j], true, aTags[j]);

    R(p3, [244.5, 12, 271, 197], C["白"]);
    R(p3, [244.5, 12, 271, 14], C["バイオレット"]);
    T(p3, [247, 19, 268.5, 60], [["Check!", "Check"]], {vcenter: true});
    T(p3, [248, 62, 268, 96], [["デジタルで" + BR + "工数削減", "フロー"], ["校正・索引・赤字・資料", "フロー_小"]], {vcenter: true});
    T(p3, [248, 96, 268, 102], [["▶", "矢印"]], {vcenter: true});
    T(p3, [248, 102, 268, 133], [["浮いた" + BR + "予算", "フロー"], ["人件費を圧縮", "フロー_小"]], {vcenter: true});
    T(p3, [248, 133, 268, 139], [["▶", "矢印"]], {vcenter: true});
    T(p3, [248, 140, 268, 192], [["こだわりの" + BR + "一冊へ", "フロー_ゴール"], ["装丁・印刷・造本設計", "フロー_小"]],
        {vcenter: true, stroke: C["オレンジ"], sw: 1.1, radius: 2});
    footer(p3, false, "工数はデジタルで減らして、予算は本そのものに使うんだニャ", ["デジタル", "本そのもの"], "3");

    /* ================= p4 裏表紙 ================= */
    header(p4, true, "MESSAGE", "「3つでひとつの本づくり」");
    R(p4, [44, -3, 117, 210], C["ブルー"]);
    T(p4, [51, 11, 73, 198], [["3つのセミナーは、ひとつながり。" + BR + "通しで聞くと、本づくりの流れが見えてきます。", "裏_リード"]],
        {cs: [["ひとつながり", "オレンジ強調"]]});
    var steps = [
        ["SEMINAR #1　10:30〜", "編集・校正", "機械の目と事前修正で、確認作業の時間を減らす"],
        ["SEMINAR #2　13:30〜", "制作", "AIとノウハウで、手間のかかる記念誌も仕組みで作る"],
        ["SEMINAR #3　15:30〜", "造本", "浮いた予算を、手に取りたくなる一冊に変える"]];
    var w = (187 - 6) / 3;
    for (var k = 0; k < 3; k++) {
        var sx = 11 + k * (w + 3);
        R(p4, [76, sx, 104, sx + w], C["白"], {radius: 2.5});
        T(p4, [76, sx, 104, sx + w], [[steps[k][0], "ステップ_ラベル"], [steps[k][1], "ステップ_見出し"], [steps[k][2], "ステップ_本文"]],
            {inset: [3, 3.5, 2, 3.5], cs: [[steps[k][0].split("　")[1], "時刻"]]});
    }
    T(p4, [123, 11, 150, 198], [["工数を減らす「仕組み」と、浮いたコストを価値に変える「造本」。どちらか一方だけでは、本づくりは変わりません。#1から#3まで通してお聞きいただくことで、編集の効率化から仕上がりの品質まで、一冊の流れがつながります。人手と時間を、価値ある本に注ぎ込む。それが御社の新しい強みになります。", "裏_本文"]]);
    R(p4, [160.5, 33, 165.5, 177], C["付箋"], {name: "マーカー"});
    T(p4, [151, 0, 167, 210], [["一緒に本づくりをやりましょう。", "締め"]], {vcenter: true});

    R(p4, [177, 11, 225.5, 198], C["クリーム"], {radius: 2.5});
    T(p4, [173.5, 150, 180.5, 193], [["ご来場者プレゼント", "バッジ"]], {fill: C["オレンジ"], vcenter: true, radius: 3.5});
    R(p4, [182, 16, 221, 44], C["白"], {stroke: C["罫線"], sw: 0.3, name: "総集編の表紙（差し替え）"});
    R(p4, [194, 16, 221, 44], C["茶濃"]);
    T(p4, [184.5, 18, 193, 43], [["誰も教えてくれなかった", "ミニ_小"], ["ブック印刷のコト", "ミニ_題"]]);
    T(p4, [215.5, 18, 220, 40], [["総集編", "ミニ_総集編"]]);
    T(p4, [182, 50, 223, 194], [
        ["印刷技術情報誌", "プレゼント_小"],
        ["『ブック印刷のコト』総集編を" + BR + "もれなくプレゼントいたします", "プレゼント_見出し"],
        ["紙はなぜ焼けるの？　インキの匂いって？　ズレはどうして起きるの？", "プレゼント_疑問"],
        ["本づくりにまつわる、あれこれの疑問を科学的に解説しています。", "プレゼント_本文"]]);

    L(p4, 241.5, 11, 241.5, 198, C["罫線"], 0.85);
    T(p4, [244.5, 11, 273, 112], [
        ["会場", "情報_見出し"],
        ["日本教育会館 703号室", "情報_強"],
        ["東京都千代田区一ツ橋2丁目6−2" + BR + "都営新宿線・三田線、東京メトロ半蔵門線「神保町」駅 A8出口 徒歩約3分／東京メトロ東西線「竹橋」駅 徒歩約5分", "情報_本文"]]);
    T(p4, [244.5, 118, 273, 176], [
        ["お申込み・お問い合わせ", "情報_見出し"],
        ["TEL：000-000-0000" + BR + "MAIL：xxxx@iword.co.jp" + BR + "担当：〇〇", "情報_本文"]],
        {name: "問い合わせ先（要差し替え）", cs: [["000-000-0000", "仮テキスト"], ["xxxx@iword.co.jp", "仮テキスト"], ["〇〇", "仮テキスト"]]});
    R(p4, [251, 178, 271, 198], null, {stroke: C["オレンジ"], sw: 0.85, name: "QRコード（差し替え）"});
    footer(p4, true, "株式会社アイワード　https://www.iword.co.jp", ["https://www.iword.co.jp"], null);

    // ---- 保存と結果報告 ----
    var over = [];
    var tfs = doc.textFrames.everyItem().getElements();
    for (var t = 0; t < tfs.length; t++) {
        if (tfs[t].overflows && tfs[t].parentPage) over.push("p" + tfs[t].parentPage.name + "：" + tfs[t].contents.substr(0, 14));
    }
    var file = File(Folder.desktop + "/ブック印刷のコトセミナー.indd");
    doc.save(file);

    var msg = "作成しました：\n" + file.fsName;
    if (MISSING.length) msg += "\n\n■ 代替したフォント（推奨フォント未インストール）：\n" + MISSING.join("\n");
    if (over.length) msg += "\n\n■ 文字があふれている枠：\n" + over.join("\n");
    alert(msg);
}

try {
    main();
} catch (e) {
    alert("エラーが発生しました（" + (e.line ? e.line + "行目" : "") + "）\n" + e.message + "\n\nこの画面のスクリーンショットを Claude に送ってください。");
}
