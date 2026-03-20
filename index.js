#!/usr/bin/env node
require("dotenv").config();
const axios = require("axios");
const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");

// ======================== Config ========================

const ENV = process.env.SHOPCRAFT_ENV || "prod"; // "dev" or "prod"

const BASE_URLS = {
  prod: "https://kj1688.puyunsoft.cn",
  dev: "https://kj1688-dev.puyunsoft.cn",
};

const CONFIG = {
  baseURL: process.env.SHOPCRAFT_API_BASE_URL || BASE_URLS[ENV] || BASE_URLS.prod,
  outputDir: process.env.SHOPCRAFT_OUTPUT_DIR || "",
  timeout: 15000,
  maxResults: 20,
};

// ======================== HTTP Helper ========================

const client = axios.create({
  baseURL: CONFIG.baseURL,
  timeout: CONFIG.timeout,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * 通用请求封装
 * @param {"get"|"post"} method
 * @param {string} url
 * @param {object} [params] - GET 查询参数 或 POST body
 * @returns {Promise<any>}
 */
async function request(method, url, params = {}) {
  try {
    const res =
      method === "get"
        ? await client.get(url, { params })
        : await client.post(url, params);
    return res.data;
  } catch (err) {
    const msg =
      err.response?.data?.message ||
      err.response?.statusText ||
      err.message ||
      "Unknown error";
    const status = err.response?.status || 0;
    throw new Error(`API request failed (${status}): ${msg}`);
  }
}

// ======================== Data Filter ========================

/**
 * 数据清洗：只保留指定字段，限制返回条数
 * @param {Array} list - 原始数组
 * @param {string[]} fields - 需要保留的字段名
 * @param {number} [limit] - 最大返回条数
 * @returns {Array}
 */
function filterData(list, fields, limit = CONFIG.maxResults) {
  if (!Array.isArray(list)) return list;
  return list.slice(0, limit).map((item) => {
    const filtered = {};
    for (const key of fields) {
      if (item[key] !== undefined) {
        filtered[key] = item[key];
      }
    }
    return filtered;
  });
}

// ======================== Time Helpers ========================

function formatDateShort(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

function calcTimeLabel(params) {
  if (params.timeLabel) return params.timeLabel;

  if (params.startTime && params.endTime) {
    return `${formatDateShort(params.startTime)}-${formatDateShort(params.endTime)}`;
  }

  const type = params.timeRangeType || "LAST_WEEK";
  const now = new Date();

  if (type === "LAST_WEEK") {
    const dow = now.getDay() || 7;
    const mon = new Date(now);
    mon.setDate(now.getDate() - dow - 6);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return `${formatDateShort(mon)}-${formatDateShort(sun)}`;
  }

  if (type === "LAST_7_DAYS") {
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    return `${formatDateShort(start)}-${formatDateShort(now)}`;
  }

  if (type === "LAST_30_DAYS") {
    const start = new Date(now);
    start.setDate(now.getDate() - 30);
    return `${formatDateShort(start)}-${formatDateShort(now)}`;
  }

  return "";
}

// ======================== Actions ========================

/**
 * 查询新增用户（存在店铺绑定）
 * GET /statistics/recent-new-users
 *
 * 两种传参方式（互斥，不要同时传）：
 *   方式一：startTime + endTime  自定义时间范围
 *   方式二：timeRangeType        快速选择（LAST_WEEK | LAST_7_DAYS | LAST_30_DAYS）
 *
 * @param {object} params
 * @param {string} [params.startTime]     - 查询开始时间
 * @param {string} [params.endTime]       - 查询结束时间
 * @param {string} [params.timeRangeType] - 时间范围类型：LAST_WEEK | LAST_7_DAYS | LAST_30_DAYS
 */
async function queryNewUsers(params = {}) {
  // 校验互斥：startTime/endTime 与 timeRangeType 不能同时传
  const hasCustomRange = params.startTime || params.endTime;
  const hasPresetRange = params.timeRangeType;
  if (hasCustomRange && hasPresetRange) {
    return {
      success: false,
      code: 400,
      msg: "startTime/endTime 与 timeRangeType 互斥，请只选择一种传参方式",
      data: null,
    };
  }

  const query = {};
  if (params.startTime) query.startTime = params.startTime;
  if (params.endTime) query.endTime = params.endTime;
  if (params.timeRangeType) query.timeRangeType = params.timeRangeType;

  const res = await request("get", "/statistics/recent-new-users", query);

  return {
    success: res.success,
    code: res.code,
    msg: res.msg,
    data: res.data, // { count: number }
  };
}

/**
 * 生成绑店客户回访表格（Excel）
 * 复用 /statistics/recent-new-users 接口数据，生成 .xlsx 文件
 *
 * 两种传参方式（互斥，不要同时传）：
 *   方式一：startTime + endTime  自定义时间范围
 *   方式二：timeRangeType        快速选择（LAST_WEEK | LAST_7_DAYS | LAST_30_DAYS）
 *
 * @param {object} params
 * @param {string} [params.startTime]     - 查询开始时间
 * @param {string} [params.endTime]       - 查询结束时间
 * @param {string} [params.timeRangeType] - 时间范围类型：LAST_WEEK | LAST_7_DAYS | LAST_30_DAYS
 * @param {string} [params.outputDir]     - 输出目录，默认当前目录
 */
async function generateVisitSheet(params = {}) {
  // 校验互斥
  const hasCustomRange = params.startTime || params.endTime;
  const hasPresetRange = params.timeRangeType;
  if (hasCustomRange && hasPresetRange) {
    return {
      success: false,
      code: 400,
      msg: "startTime/endTime 与 timeRangeType 互斥，请只选择一种传参方式",
      data: null,
    };
  }

  // 请求接口获取用户列表
  const query = {};
  if (params.startTime) query.startTime = params.startTime;
  if (params.endTime) query.endTime = params.endTime;
  if (params.timeRangeType) query.timeRangeType = params.timeRangeType;

  const res = await request("get", "/statistics/recent-new-users", query);

  if (!res.success) {
    return { success: false, code: res.code, msg: res.msg, data: null };
  }

  const list = res.data?.list || [];
  if (list.length === 0) {
    return { success: true, code: 200, msg: "查询结果为空，无需生成表格", data: null };
  }

  // 创建 Excel
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("绑店客户回访");

  // 表头
  sheet.columns = [
    { header: "ali_id", key: "aliId", width: 18 },
    { header: "resource_owner", key: "resourceOwner", width: 22 },
    { header: "member_id", key: "memberId", width: 30 },
    { header: "phone_number", key: "phoneNumber", width: 18 },
    { header: "is_distribute", key: "isDistribute", width: 14 },
    { header: "是否旺旺回访", key: "wangwang", width: 14 },
    { header: "是否添加企微", key: "wecom", width: 14 },
    { header: "客户回复", key: "reply", width: 20 },
  ];

  // 表头样式
  sheet.getRow(1).font = { bold: true };

  // 填充数据
  for (const item of list) {
    sheet.addRow({
      aliId: item.aliId,
      resourceOwner: item.resourceOwner,
      memberId: item.memberId,
      phoneNumber: item.phoneNumber || "",
      isDistribute: item.isDistribute,
      wangwang: "",
      wecom: "",
      reply: "",
    });
  }

  // 保存文件
  const today = new Date().toISOString().slice(0, 10);
  const outputDir = params.outputDir || CONFIG.outputDir || process.cwd();
  const filePath = path.join(outputDir, `visit-sheet-${today}.xlsx`);
  await workbook.xlsx.writeFile(filePath);

  return {
    success: true,
    code: 200,
    msg: `表格已生成，共 ${list.length} 条记录`,
    data: { filePath, count: list.length },
  };
}

// ======================== Weekly Stat Sheet ========================

const WEEKLY_STAT_COLUMNS = [
  { header: "时间", width: 14 },
  { header: "累计订购总用户", width: 16 },
  { header: "新增订购用户", width: 14 },
  { header: "绑店总数量", width: 12 },
  { header: "绑定shopee", width: 12 },
  { header: "绑定Tik Tok", width: 13 },
  { header: "绑店百分率", width: 12 },
  { header: "新增采集商品数", width: 16 },
  { header: "新增用户铺货数", width: 16 },
  { header: "新增用户铺货率", width: 16 },
  { header: "总铺货数", width: 10 },
  { header: "铺货成功数", width: 12 },
  { header: "铺货成功率", width: 12 },
  { header: "铺货失败数", width: 12 },
  { header: "新增订单量", width: 12 },
  { header: "本周情况", width: 36 },
];

const PERCENT_COLS = [7, 10, 13];

function createWeeklyStatSheet(workbook) {
  const sheet = workbook.addWorksheet("店小匠数据统计");
  const colCount = WEEKLY_STAT_COLUMNS.length;

  const titleFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
  const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E75B6" } };
  const whiteFont = { bold: true, color: { argb: "FFFFFFFF" } };
  const thinBorder = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };

  sheet.mergeCells(1, 1, 1, colCount);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = "店小匠数据统计";
  titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  titleCell.fill = titleFill;
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 28;

  const headerRow = sheet.getRow(2);
  WEEKLY_STAT_COLUMNS.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = whiteFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
    sheet.getColumn(i + 1).width = col.width;
  });
  headerRow.height = 22;

  return sheet;
}

function styleDataRow(row) {
  const thinBorder = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
    if (PERCENT_COLS.includes(colNumber)) {
      cell.numFmt = "0.00%";
    }
  });
}

/**
 * 生成每周数据统计表格（Excel）
 * 调用 /statistics/system-statistics 接口，生成/追加一行周统计数据到 .xlsx 文件
 *
 * 两种传参方式（互斥，不要同时传）：
 *   方式一：startTime + endTime  自定义时间范围
 *   方式二：timeRangeType        快速选择（LAST_WEEK | LAST_7_DAYS | LAST_30_DAYS）
 *
 * @param {object} params
 * @param {string} [params.startTime]     - 查询开始时间
 * @param {string} [params.endTime]       - 查询结束时间
 * @param {string} [params.timeRangeType] - 时间范围类型
 * @param {string} [params.timeLabel]     - 自定义时间列显示文本（如 "3.10-3.16"），不传则自动计算
 * @param {string} [params.outputDir]     - 输出目录
 * @param {string} [params.fileName]      - 文件名，默认 weekly-statistics.xlsx
 */
async function generateWeeklyStatSheet(params = {}) {
  const hasCustomRange = params.startTime || params.endTime;
  const hasPresetRange = params.timeRangeType;
  if (hasCustomRange && hasPresetRange) {
    return {
      success: false,
      code: 400,
      msg: "startTime/endTime 与 timeRangeType 互斥，请只选择一种传参方式",
      data: null,
    };
  }

  const query = {};
  if (params.startTime) query.startTime = params.startTime;
  if (params.endTime) query.endTime = params.endTime;
  if (params.timeRangeType) query.timeRangeType = params.timeRangeType;

  const res = await request("get", "/statistics/system-statistics", query);
  if (!res.success) {
    return { success: false, code: res.code, msg: res.msg, data: null };
  }

  const d = res.data;
  const safeDiv = (a, b) => (b > 0 ? a / b : 0);

  const totalDistribute = (d.distributeSuccess7Days || 0) + (d.distributeFail7Days || 0);
  const timeLabel = calcTimeLabel(params);

  const rowData = [
    timeLabel,
    d.totalUsers || 0,
    d.newAliUsers || 0,
    d.newTotalShops || 0,
    d.newShopeeShops || 0,
    d.newTiktokShops || 0,
    safeDiv(d.newTotalShops || 0, d.newAliUsers || 0),
    d.newProducts || 0,
    d.newAliUsersWithDistribute || 0,
    safeDiv(d.newAliUsersWithDistribute || 0, d.newAliUsers || 0),
    totalDistribute,
    d.distributeSuccess7Days || 0,
    safeDiv(d.distributeSuccess7Days || 0, totalDistribute),
    d.distributeFail7Days || 0,
    d.orders7Days || 0,
    "",
  ];

  const outputDir = params.outputDir || CONFIG.outputDir || process.cwd();
  const fileName = params.fileName || "weekly-statistics.xlsx";
  const filePath = path.join(outputDir, fileName);

  const workbook = new ExcelJS.Workbook();
  let sheet;

  if (fs.existsSync(filePath)) {
    await workbook.xlsx.readFile(filePath);
    sheet = workbook.getWorksheet("店小匠数据统计");
    if (!sheet) {
      sheet = createWeeklyStatSheet(workbook);
    }
  } else {
    sheet = createWeeklyStatSheet(workbook);
  }

  const newRow = sheet.addRow(rowData);
  styleDataRow(newRow);

  await workbook.xlsx.writeFile(filePath);

  return {
    success: true,
    code: 200,
    msg: `每周统计表格已更新，数据行：${timeLabel}`,
    data: { filePath, timeLabel },
  };
}

/**
 * 查询系统统计数据
 * GET /statistics/system-statistics
 *
 * 两种传参方式（互斥，不要同时传）：
 *   方式一：startTime + endTime  自定义时间范围
 *   方式二：timeRangeType        快速选择（LAST_WEEK | LAST_7_DAYS | LAST_30_DAYS）
 *
 * @param {object} params
 * @param {string} [params.startTime]     - 查询开始时间
 * @param {string} [params.endTime]       - 查询结束时间
 * @param {string} [params.timeRangeType] - 时间范围类型：LAST_WEEK | LAST_7_DAYS | LAST_30_DAYS
 */
async function querySystemStatistics(params = {}) {
  const hasCustomRange = params.startTime || params.endTime;
  const hasPresetRange = params.timeRangeType;
  if (hasCustomRange && hasPresetRange) {
    return {
      success: false,
      code: 400,
      msg: "startTime/endTime 与 timeRangeType 互斥，请只选择一种传参方式",
      data: null,
    };
  }

  const query = {};
  if (params.startTime) query.startTime = params.startTime;
  if (params.endTime) query.endTime = params.endTime;
  if (params.timeRangeType) query.timeRangeType = params.timeRangeType;

  const res = await request("get", "/statistics/system-statistics", query);

  return {
    success: res.success,
    code: res.code,
    msg: res.msg,
    data: res.data,
  };
}

/**
 * 按用户维度详细统计（客户授权明细）
 * GET /statistics/user-statistics
 *
 * 两种传参方式（互斥，不要同时传）：
 *   方式一：startTime + endTime  自定义时间范围
 *   方式二：timeRangeType        快速选择（LAST_WEEK | LAST_7_DAYS | LAST_30_DAYS）
 *
 * @param {object} params
 * @param {string} [params.startTime]     - 查询开始时间
 * @param {string} [params.endTime]       - 查询结束时间
 * @param {string} [params.timeRangeType] - 时间范围类型：LAST_WEEK | LAST_7_DAYS | LAST_30_DAYS
 */
async function queryUserStatistics(params = {}) {
  const hasCustomRange = params.startTime || params.endTime;
  const hasPresetRange = params.timeRangeType;
  if (hasCustomRange && hasPresetRange) {
    return {
      success: false,
      code: 400,
      msg: "startTime/endTime 与 timeRangeType 互斥，请只选择一种传参方式",
      data: null,
    };
  }

  const query = {};
  if (params.startTime) query.startTime = params.startTime;
  if (params.endTime) query.endTime = params.endTime;
  if (params.timeRangeType) query.timeRangeType = params.timeRangeType;

  const res = await request("get", "/statistics/user-statistics", query);

  return {
    success: res.success,
    code: res.code,
    msg: res.msg,
    data: res.data,
  };
}

// ======================== User Stat Sheet ========================

const USER_STAT_COLUMNS = [
  { header: "序号", width: 8 },
  { header: "用户ID", width: 20 },
  { header: "用户昵称", width: 22 },
  { header: "用户创建时间", width: 22 },
  { header: "铺货任务数量", width: 14 },
  { header: "铺货成功次数", width: 14 },
  { header: "铺货失败次数", width: 14 },
  { header: "新绑定Shopee店铺数", width: 20 },
  { header: "新绑定TikTok店铺数", width: 20 },
  { header: "新绑定店铺总数量", width: 18 },
  { header: "新建商品数量", width: 14 },
  { header: "平台订单数量", width: 14 },
];

function createUserStatSheet(workbook) {
  const sheet = workbook.addWorksheet("客户授权明细");
  const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E75B6" } };
  const whiteFont = { bold: true, color: { argb: "FFFFFFFF" } };
  const thinBorder = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };

  const headerRow = sheet.getRow(1);
  USER_STAT_COLUMNS.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = whiteFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
    sheet.getColumn(i + 1).width = col.width;
  });
  headerRow.height = 22;

  return sheet;
}

/**
 * 生成客户授权明细表格（Excel）
 * 调用 /statistics/user-statistics 接口，生成按用户维度的详细统计表格
 *
 * 两种传参方式（互斥，不要同时传）：
 *   方式一：startTime + endTime  自定义时间范围
 *   方式二：timeRangeType        快速选择（LAST_WEEK | LAST_7_DAYS | LAST_30_DAYS）
 *
 * @param {object} params
 * @param {string} [params.startTime]     - 查询开始时间
 * @param {string} [params.endTime]       - 查询结束时间
 * @param {string} [params.timeRangeType] - 时间范围类型
 * @param {string} [params.outputDir]     - 输出目录
 * @param {string} [params.fileName]      - 文件名，默认 user-statistics-YYYY-MM-DD.xlsx
 */
async function generateUserStatSheet(params = {}) {
  const hasCustomRange = params.startTime || params.endTime;
  const hasPresetRange = params.timeRangeType;
  if (hasCustomRange && hasPresetRange) {
    return {
      success: false,
      code: 400,
      msg: "startTime/endTime 与 timeRangeType 互斥，请只选择一种传参方式",
      data: null,
    };
  }

  const query = {};
  if (params.startTime) query.startTime = params.startTime;
  if (params.endTime) query.endTime = params.endTime;
  if (params.timeRangeType) query.timeRangeType = params.timeRangeType;

  const res = await request("get", "/statistics/user-statistics", query);
  if (!res.success) {
    return { success: false, code: res.code, msg: res.msg, data: null };
  }

  const list = res.data || [];
  if (list.length === 0) {
    return { success: true, code: 200, msg: "查询结果为空，无需生成表格", data: null };
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = createUserStatSheet(workbook);

  const thinBorder = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };

  list.forEach((item, idx) => {
    const row = sheet.addRow([
      idx + 1,
      item.userId || "",
      item.userNickName || "",
      item.userCreateTime || "",
      item.distributeTaskCount || 0,
      item.distributeSuccessCount || 0,
      item.distributeFailCount || 0,
      item.newShopeeShops || 0,
      item.newTiktokShops || 0,
      item.newTotalShops || 0,
      item.newProducts || 0,
      item.platformOrderCount || 0,
    ]);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = thinBorder;
    });
  });

  const today = new Date().toISOString().slice(0, 10);
  const outputDir = params.outputDir || CONFIG.outputDir || process.cwd();
  const fileName = params.fileName || `user-statistics-${today}.xlsx`;
  const filePath = path.join(outputDir, fileName);
  await workbook.xlsx.writeFile(filePath);

  return {
    success: true,
    code: 200,
    msg: `客户授权明细表格已生成，共 ${list.length} 条记录`,
    data: { filePath, count: list.length },
  };
}

// ======================== Action Registry ========================

const actions = {
  queryNewUsers,
  generateVisitSheet,
  querySystemStatistics,
  generateWeeklyStatSheet,
  queryUserStatistics,
  generateUserStatSheet,
};

// ======================== CLI Router ========================

async function main() {
  const actionName = process.argv[2];
  const rawParams = process.argv[3];

  if (!actionName || !actions[actionName]) {
    const available = Object.keys(actions).join(", ");
    console.log(
      JSON.stringify({
        success: false,
        error: `Unknown action: "${actionName || ""}". Available actions: ${available}`,
      })
    );
    process.exit(1);
  }

  let params = {};
  if (rawParams) {
    try {
      params = JSON.parse(rawParams);
    } catch {
      console.log(
        JSON.stringify({
          success: false,
          error: `Invalid JSON params: ${rawParams}`,
        })
      );
      process.exit(1);
    }
  }

  try {
    const result = await actions[actionName](params);
    console.log(JSON.stringify(result));
  } catch (err) {
    console.log(
      JSON.stringify({
        success: false,
        error: err.message,
      })
    );
    process.exit(1);
  }
}

main();
