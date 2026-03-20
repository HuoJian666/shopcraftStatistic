---
name: shopcraft-statistic
description: >
  店小匠产品统计数据查询技能。支持查询系统统计数据、按用户维度详细统计（客户授权明细）、
  新增用户（存在店铺绑定）统计数据，生成每周数据统计 Excel 表格，以及生成绑店客户回访 Excel 表格。
  可按时间范围筛选，支持自定义起止时间或快速选择（上周、近7天、近30天）。
version: 1.0.0
author: lensung
requires:
  env:
    - SHOPCRAFT_ENV
  runtime: node
---

# ShopCraft Statistic Skill

用于查询店小匠产品的统计数据，辅助运营人员进行数据分析和客户回访管理。

## 快速开始

### 1. 配置文件输出目录

首先配置生成文件（如回访表格）的存放路径。复制 `.env.example` 为 `.env`，并设置 `SHOPCRAFT_OUTPUT_DIR`：

```bash
cp .env.example .env
```

编辑 `.env`，填入你希望文件生成到的目录路径：

```env
SHOPCRAFT_OUTPUT_DIR=D:\output
```

### 2. 安装依赖

```bash
npm install
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

---

### generateWeeklyStatSheet

生成每周数据统计 Excel 表格。调用 `/statistics/system-statistics` 接口获取系统统计数据，自动计算衍生指标，生成/追加一行数据到 `.xlsx` 文件。如果目标文件已存在，会在已有数据下方追加新行，适合每周持续维护同一份统计表。

**接口：** `GET /statistics/system-statistics`

**生成的表格列：**

| 列 | 表头             | 数据来源                                      |
|----|------------------|-----------------------------------------------|
| A  | 时间             | 自动计算或 `timeLabel` 参数指定                  |
| B  | 累计订购总用户    | totalUsers                                    |
| C  | 新增订购用户      | newAliUsers                                   |
| D  | 绑店总数量        | newTotalShops                                 |
| E  | 绑定shopee       | newShopeeShops                                |
| F  | 绑定Tik Tok      | newTiktokShops                                |
| G  | 绑店百分率        | **计算：** 绑店总数量 / 新增订购用户              |
| H  | 新增采集商品数    | newProducts                                    |
| I  | 新增用户铺货数    | newAliUsersWithDistribute                      |
| J  | 新增用户铺货率    | **计算：** 新增用户铺货数 / 新增订购用户           |
| K  | 总铺货数          | **计算：** 铺货成功数 + 铺货失败数                |
| L  | 铺货成功数        | distributeSuccess7Days                         |
| M  | 铺货成功率        | **计算：** 铺货成功数 / 总铺货数                  |
| N  | 铺货失败数        | distributeFail7Days                            |
| O  | 新增订单量        | orders7Days                                    |
| P  | 本周情况          | 空列，手动填写                                  |

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

其他参数：

| 参数名    | 类型   | 说明                                                          |
| --------- | ------ | ------------------------------------------------------------- |
| timeLabel | string | 自定义"时间"列显示文本（如 `3.10-3.16`），不传则自动计算         |
| outputDir | string | 输出目录，默认使用环境变量或当前工作目录                         |
| fileName  | string | 文件名，默认 `weekly-statistics.xlsx`                          |

**调用示例：**

```bash
# 生成上周统计（最常用）
node index.js generateWeeklyStatSheet '{"timeRangeType":"LAST_WEEK"}'

# 自定义时间范围
node index.js generateWeeklyStatSheet '{"startTime":"2026-03-10","endTime":"2026-03-16"}'

# 自定义时间标签 + 指定输出目录
node index.js generateWeeklyStatSheet '{"timeRangeType":"LAST_WEEK","timeLabel":"3.10-3.16","outputDir":"D:\\output"}'
```

**输出文件：** `weekly-statistics.xlsx`（默认文件名，可通过 `fileName` 参数自定义）

**返回示例：**

```json
{
  "success": true,
  "code": 200,
  "msg": "每周统计表格已更新，数据行：3.10-3.16",
  "data": {
    "filePath": "D:\\output\\weekly-statistics.xlsx",
    "timeLabel": "3.10-3.16"
  }
}
```

---

### querySystemStatistics

查询系统统计数据。返回指定时间范围内的系统运营核心指标，包括用户数、店铺数、采集商品数、铺货情况和订单数等。

**接口：** `GET /statistics/system-statistics`

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
node index.js querySystemStatistics '{"startTime":"2026-03-01","endTime":"2026-03-19"}'

# 方式二：快速选择
node index.js querySystemStatistics '{"timeRangeType":"LAST_WEEK"}'
```

**返回字段说明：**

| 字段    | 类型    | 说明       |
| ------- | ------- | ---------- |
| success | boolean | 成功标识   |
| code    | integer | 状态码     |
| msg     | string  | 消息内容   |
| data    | object  | 数据对象   |

`data`（SystemStatisticsVo）包含：

| 字段                       | 类型    | 说明                              |
| -------------------------- | ------- | --------------------------------- |
| totalUsers                 | integer | 总用户数                          |
| newAliUsers                | integer | 新增1688用户（上周一至本周一）       |
| newAliUsersWithDistribute  | integer | 新增1688用户（存在铺货记录）        |
| newShopeeShops             | integer | 新增 Shopee 店铺数量               |
| newTiktokShops             | integer | 新增 TikTok 店铺数量               |
| newTotalShops              | integer | 新绑定店铺（Shopee + TikTok）      |
| newProducts                | integer | 新增采集商品数量                    |
| distributeSuccess7Days     | integer | 近7天铺货成功数量                   |
| distributeFail7Days        | integer | 近7天铺货失败数量                   |
| orders7Days                | integer | 近7天订单数                        |

**返回示例：**

```json
{
  "code": 200,
  "success": true,
  "msg": "操作成功",
  "data": {
    "totalUsers": 1500,
    "newAliUsers": 32,
    "newAliUsersWithDistribute": 18,
    "newShopeeShops": 25,
    "newTiktokShops": 12,
    "newTotalShops": 37,
    "newProducts": 460,
    "distributeSuccess7Days": 320,
    "distributeFail7Days": 15,
    "orders7Days": 188
  }
}
```

---

### queryUserStatistics

按用户维度详细统计（客户授权明细）。返回指定时间范围内每个用户的铺货、店铺绑定、商品采集和订单等维度的详细统计数据。

**接口：** `GET /statistics/user-statistics`

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
node index.js queryUserStatistics '{"startTime":"2026-03-01","endTime":"2026-03-19"}'

# 方式二：快速选择
node index.js queryUserStatistics '{"timeRangeType":"LAST_WEEK"}'
```

**返回字段说明：**

| 字段    | 类型    | 说明                     |
| ------- | ------- | ------------------------ |
| success | boolean | 成功标识                 |
| code    | integer | 状态码                   |
| msg     | string  | 消息内容                 |
| data    | array   | 用户维度统计数据列表       |

`data` 数组中每个元素（UserStatisticsVo）包含：

| 字段                    | 类型    | 说明               |
| ----------------------- | ------- | ------------------ |
| userId                  | string  | 用户 ID            |
| userNickName            | string  | 用户昵称           |
| userCreateTime          | string  | 用户创建时间       |
| distributeTaskCount     | integer | 铺货任务数量       |
| distributeSuccessCount  | integer | 铺货成功次数       |
| distributeFailCount     | integer | 铺货失败次数       |
| newShopeeShops          | integer | 新绑定 Shopee 店铺数 |
| newTiktokShops          | integer | 新绑定 TikTok 店铺数 |
| newTotalShops           | integer | 新绑定店铺总数     |
| newProducts             | integer | 新建商品数量       |
| platformOrderCount      | integer | 平台订单数量       |

**返回示例：**

```json
{
  "code": 200,
  "success": true,
  "msg": "操作成功",
  "data": [
    {
      "userId": "12345",
      "userNickName": "用户A",
      "userCreateTime": "2026-03-10 10:30:00",
      "distributeTaskCount": 50,
      "distributeSuccessCount": 42,
      "distributeFailCount": 8,
      "newShopeeShops": 3,
      "newTiktokShops": 1,
      "newTotalShops": 4,
      "newProducts": 120,
      "platformOrderCount": 35
    }
  ]
}
```

## 环境变量

| 变量名                 | 必填 | 说明                                                                 |
| ---------------------- | ---- | -------------------------------------------------------------------- |
| SHOPCRAFT_ENV          | 否   | 环境切换：`dev`（测试环境）或 `prod`（正式环境），默认 `prod`            |
| SHOPCRAFT_API_BASE_URL | 否   | 自定义 API 基础地址（设置后覆盖 SHOPCRAFT_ENV 对应的默认地址）          |
| SHOPCRAFT_OUTPUT_DIR   | 否   | 生成文件的默认输出目录（调用时传 `outputDir` 参数可覆盖此配置）          |

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
