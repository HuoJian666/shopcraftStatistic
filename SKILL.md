---
name: shopcraft-statistic
description: >
  店小匠产品统计数据查询技能。支持查询新增用户（存在店铺绑定）统计数据，
  以及生成绑店客户回访 Excel 表格。可按时间范围筛选，支持自定义起止时间或快速选择（上周、近7天、近30天）。
version: 1.0.0
author: lensung
requires:
  env:
    - SHOPCRAFT_ENV
    - SHOPCRAFT_API_KEY
  runtime: node
---

# ShopCraft Statistic Skill

用于查询店小匠产品的统计数据，辅助运营人员进行数据分析和客户回访管理。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，并填入真实配置：

```bash
cp .env.example .env
```

### 3. 运行

```bash
node index.js <action> '<json params>'
```

## 可用操作

### queryNewUsers

查询新增用户（存在店铺绑定）的统计数据。返回指定时间范围内新增绑店用户的数量和详细列表。

**接口：** `GET /statistics/recent-new-users`

**参数（两种传参方式互斥，不要同时传）：**

方式一：自定义时间范围

| 参数名    | 类型   | 说明                                       |
| --------- | ------ | ------------------------------------------ |
| startTime | string | 查询开始时间（用于SQL 2和SQL 3的动态时间范围） |
| endTime   | string | 查询结束时间（用于SQL 2和SQL 3的动态时间范围） |

方式二：快速选择时间范围

| 参数名        | 类型   | 说明                                                                          |
| ------------- | ------ | ----------------------------------------------------------------------------- |
| timeRangeType | string | 可选值：`LAST_WEEK`（上周）、`LAST_7_DAYS`（近7天）、`LAST_30_DAYS`（近30天）   |

> 注意：`startTime`/`endTime` 与 `timeRangeType` 互斥，只能选择其中一种方式传参。

**调用示例：**

```bash
# 方式一：自定义时间范围
node index.js queryNewUsers '{"startTime":"2026-03-01","endTime":"2026-03-19"}'

# 方式二：快速选择
node index.js queryNewUsers '{"timeRangeType":"LAST_7_DAYS"}'
```

**返回字段说明：**

| 字段    | 类型    | 说明       |
| ------- | ------- | ---------- |
| success | boolean | 成功标识   |
| code    | integer | 状态码     |
| msg     | string  | 消息内容   |
| data    | object  | 数据对象   |

`data` 包含：

| 字段          | 类型    | 说明                        |
| ------------- | ------- | --------------------------- |
| list          | array   | 用户列表                     |
| list[].aliId          | string  | 阿里 ID                |
| list[].resourceOwner  | string  | 资源所有者（用户名）     |
| list[].memberId       | string  | 会员 ID                 |
| list[].phoneNumber    | string  | 手机号（可能为空）       |
| list[].isDistribute   | integer | 是否已分配（1=是，0=否） |

**返回示例：**

```json
{
  "code": 200,
  "success": true,
  "msg": "操作成功",
  "data": {
    "list": [
      {
        "aliId": "803574884",
        "resourceOwner": "用户名",
        "memberId": "b2b-80357488477d65",
        "phoneNumber": "13800138000",
        "isDistribute": 1
      }
    ]
  }
}
```

---

### generateVisitSheet

生成绑店客户回访 Excel 表格（`.xlsx`）。复用 `/statistics/recent-new-users` 接口数据，生成包含用户信息和回访记录列的文件，方便运营人员线下跟进回访。

**生成的表格列：**

| 列 | 字段名         | 来源                  |
|----|----------------|-----------------------|
| A  | ali_id         | 接口返回 aliId         |
| B  | resource_owner | 接口返回 resourceOwner |
| C  | member_id      | 接口返回 memberId      |
| D  | phone_number   | 接口返回 phoneNumber   |
| E  | is_distribute  | 接口返回 isDistribute  |
| F  | 是否旺旺回访    | 空列，手动填写          |
| G  | 是否添加企微    | 空列，手动填写          |
| H  | 客户回复        | 空列，手动填写          |

**参数（两种传参方式互斥，不要同时传）：**

方式一：自定义时间范围

| 参数名    | 类型   | 说明         |
| --------- | ------ | ------------ |
| startTime | string | 查询开始时间 |
| endTime   | string | 查询结束时间 |

方式二：快速选择时间范围

| 参数名        | 类型   | 说明                                                                          |
| ------------- | ------ | ----------------------------------------------------------------------------- |
| timeRangeType | string | 可选值：`LAST_WEEK`（上周）、`LAST_7_DAYS`（近7天）、`LAST_30_DAYS`（近30天）   |

其他参数：

| 参数名    | 类型   | 说明                           |
| --------- | ------ | ------------------------------ |
| outputDir | string | 输出目录，默认当前工作目录       |

> 注意：`startTime`/`endTime` 与 `timeRangeType` 互斥，只能选择其中一种方式传参。

**调用示例：**

```bash
# 近7天数据
node index.js generateVisitSheet '{"timeRangeType":"LAST_7_DAYS"}'

# 自定义时间范围
node index.js generateVisitSheet '{"startTime":"2026-03-01","endTime":"2026-03-19"}'

# 指定输出目录
node index.js generateVisitSheet '{"timeRangeType":"LAST_7_DAYS","outputDir":"D:\\output"}'
```

**输出文件：** `visit-sheet-YYYY-MM-DD.xlsx`（以生成当天日期命名）

**返回示例：**

```json
{
  "success": true,
  "code": 200,
  "msg": "表格已生成，共 22 条记录",
  "data": {
    "filePath": "E:\\workSpace\\visit-sheet-2026-03-19.xlsx",
    "count": 22
  }
}
```

## 环境变量

| 变量名                 | 必填 | 说明                                                                 |
| ---------------------- | ---- | -------------------------------------------------------------------- |
| SHOPCRAFT_ENV          | 否   | 环境切换：`dev`（测试环境）或 `prod`（正式环境），默认 `prod`            |
| SHOPCRAFT_API_BASE_URL | 否   | 自定义 API 基础地址（设置后覆盖 SHOPCRAFT_ENV 对应的默认地址）          |
| SHOPCRAFT_API_KEY      | 否   | 店小匠 API 认证密钥                                                   |

**内置环境地址：**

| 环境 | 地址                                |
| ---- | ----------------------------------- |
| prod | `https://kj1688.puyunsoft.cn`       |
| dev  | `https://kj1688-dev.puyunsoft.cn`   |

## 技术栈

- **运行时：** Node.js
- **HTTP 请求：** axios
- **Excel 生成：** exceljs
- **环境变量：** dotenv
