#!/usr/bin/env node
require("dotenv").config();
const axios = require("axios");
const ExcelJS = require("exceljs");
const path = require("path");

// ======================== Config ========================

const ENV = process.env.SHOPCRAFT_ENV || "prod"; // "dev" or "prod"

const BASE_URLS = {
  prod: "https://kj1688.puyunsoft.cn",
  dev: "https://kj1688-dev.puyunsoft.cn",
};

const CONFIG = {
  baseURL: process.env.SHOPCRAFT_API_BASE_URL || BASE_URLS[ENV] || BASE_URLS.prod,
  apiKey: process.env.SHOPCRAFT_API_KEY || "",
  timeout: 15000,
  maxResults: 20,
};

// ======================== HTTP Helper ========================

const client = axios.create({
  baseURL: CONFIG.baseURL,
  timeout: CONFIG.timeout,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${CONFIG.apiKey}`,
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
  const outputDir = params.outputDir || process.cwd();
  const filePath = path.join(outputDir, `visit-sheet-${today}.xlsx`);
  await workbook.xlsx.writeFile(filePath);

  return {
    success: true,
    code: 200,
    msg: `表格已生成，共 ${list.length} 条记录`,
    data: { filePath, count: list.length },
  };
}

// ======================== Action Registry ========================

const actions = {
  queryNewUsers,
  generateVisitSheet,
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
