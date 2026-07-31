(function () {
  const allowedAliases = ["张主席", "刘主席", "曾小弟"];
  const taskTypes = [
    { id: 1, name: "产品端" },
    { id: 2, name: "运营端" },
    { id: 3, name: "数据端" },
    { id: 4, name: "其他" },
  ];
  const members = allowedAliases.map((alias) => ({ alias, mention_name: "", mobile: "" }));
  const now = () => new Date().toISOString();
  let alias = localStorage.getItem("preview:alias") || "";
  let tasks = JSON.parse(localStorage.getItem("preview:tasks") || "null") || [
    { id: 1, type_name: "运营端", name: "推进7月运营选品确定", assignee: "张主席", planned_at: "2026-08-08", status: "pending", source: "manual", created_at: now(), updated_at: now(), completed_at: null },
    { id: 2, type_name: "产品端", name: "完成新品上线资料准备", assignee: "刘主席", planned_at: "2026-08-12", status: "completed", source: "manual", created_at: now(), updated_at: now(), completed_at: now() },
    { id: 3, type_name: "数据端", name: "整理本月竞品调研数据", assignee: "曾小弟", planned_at: "2026-08-15", status: "pending", source: "document", created_at: now(), updated_at: now(), completed_at: null },
  ];
  let bots = JSON.parse(localStorage.getItem("preview:bots") || "null") || [
    {
      id: 1,
      name: "运营工作群",
      webhook_masked: "https://open.feishu.cn/open-apis/bot/v2/hook/5917····8cfa",
      enabled: true,
      mention_members: [
        { id: 1, name: "张主席", wecom_id: "ou_zhang_preview", mobile: "" },
        { id: 2, name: "刘主席", wecom_id: "ou_liu_preview", mobile: "" },
      ],
      schedule: { weekdays: [1, 4], push_time: "09:00", enabled: true, configured: true },
    },
  ];
  let history = JSON.parse(localStorage.getItem("preview:history") || "null") || [
    { id: 1, trigger: "scheduled", status: "success", completed_count: 1, pending_count: 2, message_snapshot: "跨境电商小组工作进度提醒：\n任务名称：推进7月运营选品确定（计划时间：2026年8月8日）", error_message: "", created_at: now(), sent_at: now() },
  ];
  function save() {
    localStorage.setItem("preview:tasks", JSON.stringify(tasks));
    localStorage.setItem("preview:bots", JSON.stringify(bots));
    localStorage.setItem("preview:history", JSON.stringify(history));
  }
  function monthKey(value) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit" }).format(new Date(value));
  }
  function appData() {
    const thisMonth = monthKey(new Date());
    const formalHistory = history.filter((item) => item.trigger !== "test" && item.status === "success");
    return {
      authenticated: true,
      currentUser: alias || "张主席",
      tasks,
      taskTypes,
      members,
      mentionMembers: bots[0]?.mention_members || [],
      schedule: bots[0]?.schedule || { weekdays: [], push_time: "", enabled: false, configured: false },
      settings: { webhook_masked: bots[0]?.webhook_masked || "", wecom_bots: bots },
      metrics: {
        total: tasks.length,
        monthNew: tasks.filter((task) => monthKey(task.created_at) === thisMonth).length,
        pending: tasks.filter((task) => task.status === "pending").length,
        monthCompleted: tasks.filter((task) => task.completed_at && monthKey(task.completed_at) === thisMonth).length,
      },
      history,
      historyMetrics: {
        total: formalHistory.length,
        year: formalHistory.length,
        month: formalHistory.filter((item) => item.sent_at && monthKey(item.sent_at) === thisMonth).length,
      },
    };
  }
  function sharedData() {
    return {
      currentUser: alias || "张主席",
      tasks: tasks.map((task) => ({ ...task, last_changed_at: task.updated_at })),
      taskTypes,
      members: members.map(({ alias }) => ({ alias })),
    };
  }
  function json(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
  }
  function normalizeTask(input) {
    const assignee = input.assignee === "其他" ? (input.assignee_other || "").trim() : (input.assignee || "").trim();
    return {
      id: Number(input.id || Date.now()),
      type_name: (input.type_name || "").trim(),
      name: (input.name || "").trim(),
      assignee,
      planned_at: String(input.planned_at || "").slice(0, 10),
      status: input.status === "completed" ? "completed" : "pending",
      source: input.source || "manual",
      created_at: input.created_at || now(),
      updated_at: now(),
      completed_at: input.status === "completed" ? (input.completed_at || now()) : null,
    };
  }
  function applyAppAction(body) {
    const action = body.action;
    if (action === "login") {
      const nextAlias = String(body.alias || "").trim();
      if (!allowedAliases.includes(nextAlias)) return json({ error: "代号不在允许名单中" }, 401);
      alias = nextAlias;
      localStorage.setItem("preview:alias", alias);
      return json({ ok: true, alias });
    }
    if (action === "logout") {
      alias = "";
      localStorage.removeItem("preview:alias");
      return json({ ok: true });
    }
    if (!alias) return json({ error: "登录已过期，请重新登录" }, 401);
    if (action === "createTask") tasks = [normalizeTask(body.task || {}), ...tasks];
    if (action === "updateTask") tasks = tasks.map((task) => task.id === Number(body.task?.id) ? { ...task, ...normalizeTask({ ...task, ...body.task, id: task.id, created_at: task.created_at }) } : task);
    if (action === "deleteTask") tasks = tasks.filter((task) => task.id !== Number(body.id));
    if (action === "importTasks") tasks = [...(body.tasks || []).map((task) => normalizeTask({ ...task, source: "document" })), ...tasks];
    if (action === "createBot") {
      bots = [...bots, { id: Date.now(), name: body.name, webhook_masked: "https://open.feishu.cn/open-apis/bot/v2/hook/preview····demo", enabled: true, mention_members: [], schedule: { weekdays: [], push_time: "", enabled: false, configured: false } }];
    }
    if (action === "updateBot") bots = bots.map((bot) => bot.id === Number(body.id) ? { ...bot, name: body.name || bot.name, webhook_masked: body.webhook ? "https://open.feishu.cn/open-apis/bot/v2/hook/preview····demo" : bot.webhook_masked } : bot);
    if (action === "deleteBot") bots = bots.filter((bot) => bot.id !== Number(body.id));
    if (action === "setBotEnabled") bots = bots.map((bot) => bot.id === Number(body.id) ? { ...bot, enabled: Boolean(body.enabled), schedule: { ...bot.schedule, enabled: Boolean(body.enabled) } } : bot);
    if (action === "saveSettings") bots = bots.map((bot) => bot.id === Number(body.bot_id) ? { ...bot, mention_members: (body.mention_members || []).map((member, index) => ({ id: index + 1, name: member.name || "", wecom_id: member.wecom_id || "", mobile: member.mobile || "" })).filter((member) => member.name || member.wecom_id || member.mobile) } : bot);
    if (action === "saveSchedule") bots = bots.map((bot) => bot.id === Number(body.bot_id) ? { ...bot, schedule: { weekdays: body.weekdays || [], push_time: body.push_time || "09:00", enabled: Boolean(body.enabled), configured: true } } : bot);
    if (action === "deleteSchedule") bots = bots.map((bot) => bot.id === Number(body.bot_id) ? { ...bot, schedule: { weekdays: [], push_time: "", enabled: false, configured: false } } : bot);
    if (action === "testWebhook" || action === "sendTaskReminderNow") {
      history = [{ id: Date.now(), trigger: action === "testWebhook" ? "test" : "scheduled", status: "success", completed_count: tasks.filter((task) => task.status === "completed").length, pending_count: tasks.filter((task) => task.status === "pending").length, message_snapshot: "GitHub Pages 预览：消息发送动作已模拟，未触发真实飞书机器人。", error_message: "", created_at: now(), sent_at: now() }, ...history];
    }
    save();
    return json(appData());
  }
  function applySharedAction(body) {
    if (!alias) alias = "张主席";
    if (body.action === "deleteTask") tasks = tasks.filter((task) => task.id !== Number(body.task?.id));
    else if (body.action === "createTask") tasks = [...tasks, normalizeTask({ ...(body.task || {}), source: "shared" })];
    else tasks = tasks.map((task) => task.id === Number(body.task?.id) ? { ...task, ...normalizeTask({ ...task, ...body.task, id: task.id, created_at: task.created_at, source: task.source }) } : task);
    save();
    return json({ ok: true, ...sharedData() });
  }
  const realFetch = window.fetch.bind(window);
  window.fetch = async function (input, init = {}) {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    if (url.pathname === "/api/app" || url.pathname.endsWith("/api/app")) {
      if ((init.method || "GET").toUpperCase() === "GET") return alias ? json(appData()) : json({ authenticated: false }, 401);
      return applyAppAction(JSON.parse(init.body || "{}"));
    }
    if (url.pathname === "/api/shared/tasks" || url.pathname.endsWith("/api/shared/tasks")) {
      if ((init.method || "GET").toUpperCase() === "GET") return json(sharedData());
      return applySharedAction(JSON.parse(init.body || "{}"));
    }
    return realFetch(input, init);
  };
})();
