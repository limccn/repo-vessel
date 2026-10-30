/**
 * 三张翻译表。键是**简体中文原句**（msgid），不是人造键名。
 *
 * 语气基准：Dota 2 的器物感 —— 灵龛、灰烬、充能、入龛。但界面动作必须一眼
 * 可懂，不能为了「像游戏」把「保存图片」写成诗。事实句保持事实：未知仍是
 * 「未知」，不写成 0，不下结论。
 *
 * 新增文案时：先在组件里写简体中文，再在这里补 en / zh-Hant / ja 三条。
 * `src/shared/i18n.test.ts`（`npm run test`）会扫出空译文与占位符对不上的条目。
 */

export const EN: Record<string, string> = {
  /* ---------------------------------------------------------------- */
  /* 品牌、站点框架                                                     */
  /* ---------------------------------------------------------------- */
  "码之灵龛": "Repo Vessel",
  "当一个项目在战场上倒下，它的灰烬便会归于此龛。":
    "When a project falls in battle, its ashes come to rest in this vessel.",
  "充能完毕，随时准备为下一个项目注入生命。":
    "Charged and ready, the vessel waits to breathe life into the next.",
  "码之灵龛 · Repo Vessel": "Repo Vessel",
  "灵龛鉴定 · 沉睡仓库图鉴 · 时光收藏家":
    "Vessel Reading · A Bestiary of Sleeping Repos · Keeper of Hours",
  "输入一个 GitHub 用户名，看看你的公开仓库里哪些还在沉睡、哪些 Fork 漂泊去了哪里。":
    "Enter a GitHub username. See which of your public repositories still slumber, and where your forks have drifted.",
  "查查我的灵龛": "Inspect my vessel",
  "围观榜单": "Boards",
  "如何入龛": "Joining the Vessel",
  "GitHub 登录": "Sign in with GitHub",
  "本站只读取公开仓库的元数据，从不归档、删除、同步、改名或修改任何仓库，也不保存仓库里的任何代码。仓库带上本站的主题即可被收录；仓库主人认领之后，可以把它从榜单上隐藏。":
    "This site reads public repository metadata only. It never archives, deletes, syncs, renames, or modifies any repository, and stores no code from any of them. A repository is collected by carrying one of this site's topics; once the owner claims it, it can be hidden from the boards again.",
  "榜单": "Boards",
  "下架申请": "Takedown request",
  "Twitter / X": "Twitter / X",
  "GitHub 仓库": "GitHub repository",
  "码之灵龛需要 JavaScript 才能运行。没有它，你仍然可以直接访问公开仓库页面。":
    "Repo Vessel needs JavaScript to run. Without it, you may still visit public repository pages directly.",
  "带主题仓库": "Enrolled",
  "最长沉睡": "Longest slumber",
  "读取于": "Read at",
  "读取于 {time}": "Read {time}",
  "? 未知": "? Unknown",
  "语言": "Language",
  "语言偏好": "Language preference",
  "中文会按浏览器的地区自动选用简体或繁体。":
    "Chinese follows your browser's region and picks Simplified or Traditional on its own.",
  "当前显示：{language}": "Showing: {language}",
  "偏好没有保存成功，本次浏览仍然使用新语言。":
    "Your preference was not saved. This visit still uses the new language.",
  "跳到主要内容": "Skip to main content",
  "主导航": "Main navigation",
  "页脚导航": "Footer navigation",
  "退出": "Sign out",
  "处理中…": "Working…",
  "重试": "Retry",
  "或": "or",
  "（新窗口）": "(new window)",

  /* ---------------------------------------------------------------- */
  /* 标签                                                              */
  /* ---------------------------------------------------------------- */
  "时间胶囊": "Time Capsule",
  "最后一次推送距今已超过三年。这不代表项目已经失效，它也可能只是被好好收着。":
    "Three years or more since the last push. That is no verdict on the work; it may simply be well kept.",
  "深度待机": "Deep Standby",
  "按最后推送时间算，这个仓库有一段时间没有变化了。":
    "By its last push, this repository has stood unchanged for a while.",
  "刚刚安静": "Just Quiet",
  "有一段时间没有推送了。这不代表它停止了维护，只说明最后推送时间在这里。":
    "It has been a while since the last push. That does not mean upkeep has stopped; it only means the last push lies here.",
  "余烬未熄": "Embers Still Lit",
  "仓库安静了一段时间，但仍然有人给它点了 Star。Star 数不代表它现在仍在被使用。":
    "The repository has gone quiet, yet its stars still burn. A star count is no proof that it is still in use.",
  "远行的 Fork": "Fork Voyager",
  "这是一个 Fork，出发自另一个公开项目。":
    "This is a fork that set out from another public project.",
  "已归档": "Archived",
  "GitHub 上这个仓库已被作者归档。这是你在 GitHub 上的状态，本站没有改动它。":
    "The author has archived this repository on GitHub. That is your state there; this site did not alter it.",

  /* ---------------------------------------------------------------- */
  /* 称号                                                              */
  /* ---------------------------------------------------------------- */
  "时光收藏家": "Keeper of Hours",
  "有些想法，需要一点时间发酵。": "Some ideas must be left to ferment.",
  "余烬守护者": "Ember Warden",
  "安静下来之后，它仍被人记得。": "When it falls quiet, someone still remembers it.",
  "Fork 漂流者": "Fork Drifter",
  "有些项目出发之后，去了别的方向。":
    "Some projects set out, then chose another road.",
  "想法播种者": "Idea Seeder",
  "播种很多，也留下很多。": "Many seeds sown, many left behind.",
  "轻装旅人": "Light Traveler",
  "你的公开仓库看起来相当轻盈。":
    "Your public repositories travel light.",
  "初访者": "First Visitor",
  "先看看这里有什么。": "First, see what waits here.",

  /* ---------------------------------------------------------------- */
  /* 稀有度                                                            */
  /* ---------------------------------------------------------------- */
  "普通": "Common",
  "还在近处，尚未走远。": "Still nearby, not yet far gone.",
  "稀有": "Rare",
  "沉睡了半年以上，安静地待着。":
    "Dormant for over half a year, resting quietly.",
  "史诗": "Epic",
  "沉睡了至少一年，这段时间没有变化。":
    "Dormant for at least a year, unchanged throughout.",
  "传说": "Legendary",
  "沉睡了至少三年，被好好收着。":
    "Dormant for at least three years, kept with care.",

  /* ---------------------------------------------------------------- */
  /* 灵龛充能等级                                                       */
  /* ---------------------------------------------------------------- */
  "未启封": "Unsealed",
  "还没有仓库住进来。给一个公开仓库加上主题，它就会住进来。":
    "No repository has taken up residence yet. Add the topic to a public repository, and one will find its way here.",
  "Ⅰ 阶": "Tier Ⅰ",
  "灵龛刚点上火。": "The vessel has just been lit.",
  "Ⅱ 阶": "Tier Ⅱ",
  "已经攒下一点灰烬。": "A little ash has gathered.",
  "Ⅲ 阶": "Tier Ⅲ",
  "灰烬积成了堆。": "The ash has piled up.",
  "Ⅳ 阶": "Tier Ⅳ",
  "阶": "Tier",
  "灵龛充能等级": "Vessel Charge",
  "这次没有读到带主题的公开仓库数。":
    "The count of topic-carrying public repositories could not be read this time.",
  "再收 {n} 个仓库升到 {tier}。": "Gather {n} more to reach {tier}.",
  "{label} {tier}": "{label} {tier}",

  /* ---------------------------------------------------------------- */
  /* 未知原因                                                          */
  /* ---------------------------------------------------------------- */
  "GitHub 暂时限制了请求频率，没有读到这个值。":
    "GitHub rate-limited this request; the value was not read.",
  "读取超时，没有读到这个值。":
    "The read timed out; the value was not read.",
  "GitHub 没有提供这个值。": "GitHub did not provide this value.",
  "目标暂时无法访问，没有读到这个值。":
    "The target was unreachable; the value was not read.",
  "这次读取被截断，没有读到这个值。":
    "This read was truncated; the value was not read.",

  /* ---------------------------------------------------------------- */
  /* 榜单                                                              */
  /* ---------------------------------------------------------------- */
  "最长沉睡榜": "Longest Slumber",
  "它们没有走远，只是很久没有推送。":
    "They have not gone far. They have merely slept long.",
  "余烬未熄榜": "Embers Still Burning",
  "有些仓库安静了，星星还亮着。":
    "Some repositories have gone quiet, but their stars still shine.",
  "Fork 漂流榜": "Fork Drift",
  "从别处出发，在这里继续走了一段。":
    "They set out elsewhere, then walked a while here.",
  "收录条件：仓库带有 {topics} 主题，且沉睡 ≥ {days} 天、Star ≥ {stars}。":
    "To be counted: carries the {topics} topic, dormant ≥ {days} days, and ≥ {stars} stars.",
  "收录条件：仓库带有 {topics} 主题，且是一个 Fork，沉睡 ≥ {days} 天。":
    "To be counted: carries the {topics} topic, is a fork, and has slept ≥ {days} days.",
  "收录条件：仓库带有 {topics} 主题，且沉睡 ≥ {days} 天。":
    "To be counted: carries the {topics} topic and has slept ≥ {days} days.",

  /* ---------------------------------------------------------------- */
  /* 收录状态                                                          */
  /* ---------------------------------------------------------------- */
  "已入龛": "Enshrined",
  "这个仓库已经在龛里了。它在哪张榜上出现，取决于沉睡时间与 Star 数。":
    "This repository is already in the vessel. Which board it appears on depends on how long it has slept and how many stars it holds.",
  "待入龛": "Awaiting Enshrinement",
  "条件都满足了，下一次收录就会把它收进来。收录每六小时跑一轮。":
    "All conditions are met. The next run will bring it in; collection runs every six hours.",
  "还没有主题": "No Topic",
  "这个仓库没有带上本站的任何一个主题。加上主题之后，下一轮收录就会收进它。":
    "This repository carries none of this site's topics. Add one, and the next collection run will take it in.",
  "不收录": "Not Eligible",
  "本站只收录个人账户的公开仓库。组织账户与私有仓库不在收录范围内。":
    "This site only collects public repositories owned by personal accounts. Organization accounts and private repositories are out of scope.",
  "这次没能确认": "Unconfirmed",
  "没有读到确定的结果 —— 这不代表它没有主题，也不代表它不合格。稍后再查一次。":
    "No definite result was read. That does not mean it has no topic, nor that it fails the criteria. Look again later.",
  "收录数据暂时读不到。稍后再试。":
    "Collection data cannot be read right now. Try again later.",
  "认领记录暂时读不到。稍后再试。":
    "Claim records cannot be read right now. Try again later.",
  "暂时确认不了这个仓库的状态，稍后再试。":
    "The repository status cannot be confirmed right now. Try again later.",

  /* ---------------------------------------------------------------- */
  /* 下架工单                                                          */
  /* ---------------------------------------------------------------- */
  "已收到": "Received",
  "已处理": "Actioned",
  "未通过": "Rejected",
  "工单号": "Ticket number",
  "已复制": "Copied",
  "复制": "Copy",
  "状态": "Status",
  "提交于": "Submitted",
  "更新于": "Updated",
  "提交下架申请": "File a takedown",
  "说明（可不填）": "Note (optional)",
  "一句说明就好。": "A sentence is enough.",
  "提交申请": "Submit request",
  "下架工单": "Takedown ticket",
  "申请已收到。": "Request received.",
  "我们会在这个时限内看一遍：{hours} 小时。把工单号抄下来，凭它可以查状态。":
    "We will review it within {hours} hours. Copy down the ticket number; with it you can check the status.",
  "提交于 {time}。提交不会立刻隐藏仓库 —— 核实之后才会处理。":
    "Submitted {time}. A request does not hide the repository at once; it is processed after verification.",
  "查询工单": "Check a ticket",
  "查一下工单": "Check a ticket",
  "下架时拿到的工单号": "The ticket number you received",
  "查询": "Check",
  "你的仓库出现在了榜单上，但你不想让它在这里？不需要 GitHub 登录，也不需要任何账号。":
    "Your repository stands on a board, but you would rather it did not? Neither a GitHub sign-in nor an account is required.",
  "提交仓库地址和一句说明即可。我们会核实，然后把这条记录从榜单上撤下来，并且不会把它加回任何榜单。":
    "Send the repository address and one sentence. We will verify it, take the entry down from the board, and will not add it back to any board.",
  "不会收集你的邮箱 —— 本站没有回信渠道，收了只会让你以为会有回信。":
    "We do not collect your email. This site has no channel for replies; taking an address would only make you expect one.",
  "请填写仓库地址，例如 owner/name。":
    "Enter a repository address, for example owner/name.",
  "下架申请暂时提交不了。稍后再试。":
    "The takedown request cannot be submitted right now. Try again later.",
  "工单状态暂时查不到。稍后再试。":
    "The ticket status cannot be checked right now. Try again later.",
  "没有找到这张工单。": "No such ticket was found.",

  /* ---------------------------------------------------------------- */
  /* 首页                                                              */
  /* ---------------------------------------------------------------- */
  "灵龛鉴定": "Vessel Reading",
  "看看你的仓库里哪些还在沉睡。":
    "See which of your repositories still sleep.",
  "输入一个 GitHub 用户名，本站只读取公开仓库的元数据：最后一次推送是什么时候、有多少人给它点过 Star、哪些是 Fork、从哪里出发。不会读取仓库里的任何代码，也不会改动你的任何仓库。":
    "Enter a GitHub username. This site reads only the metadata of public repositories: when each last saw a push, how many stars it holds, whether it is a fork, and where it set out from. It reads no code within your repositories and changes none of them.",
  "GitHub 用户名": "GitHub username",
  "你的 GitHub 用户名": "Your GitHub username",
  "开始鉴定": "Begin the reading",
  "围观中的灵龛": "Vessels Being Read",
  "这些灵龛正在被打开。你的也可以。":
    "These vessels are being opened. Yours can be too.",
  "最长沉睡天数": "Longest slumber (days)",

  /* ---------------------------------------------------------------- */
  /* 鉴定页                                                            */
  /* ---------------------------------------------------------------- */
  "这次没能读到结果。数据还在，你可以稍后再试。":
    "The reading could not be taken this time. The data remains; try again later.",
  "这是 {ago} 前的数据": "This data is {ago} old.",
  "沉睡最久": "Longest slumber",
  "余烬最亮": "Brightest ember",
  "本次结果可能不完整": "This result may be incomplete",
  "重新读取": "Read again",
  "只读取到了前 {n} 个仓库，":
    "Only the first {n} repositories were read.",
  "第 {n} 页没有读到。": "Page {n} could not be read.",
  "还有一部分没有读到。": "Part of the result could not be read.",
  "数据仍然真实，只是可能已经过时。":
    "The data is still true; it may simply be old.",
  "{login} 的灵龛鉴定": "{login}'s Vessel Reading",
  "仍有余烬": "Embers remain",
  "余烬仓库数": "Ember repositories",
  "{n} 个": "{n}",
  "公开 Fork": "Public forks",
  "Fork 数量": "Fork count",
  "已归档数量": "Archived count",
  "公开仓库": "Public repositories",
  "仓库数量": "Repository count",
  "查看我的仓库": "View my repositories",
  "去分享": "Share",
  "三个代表": "Three representatives",
  "按沉睡时长、余烬亮度与 Fork 旅程各选一个":
    "One each by slumber, ember-light, and fork journey",
  "暂时没有找到这一类仓库。": "No repository of this kind was found.",
  "后续": "Next",
  "→ 打开完整的仓库列表": "→ Open the full repository list",
  "正在读取 {login} 的公开仓库…": "Reading {login}'s public repositories…",
  "正在读取…": "Reading…",

  /* ---------------------------------------------------------------- */
  /* 仓库列表                                                          */
  /* ---------------------------------------------------------------- */
  "最近推送": "Recently pushed",
  "Star 最多": "Most stars",
  "名称": "Name",
  "这次没能读到仓库列表。稍后再试。":
    "The repository list could not be read this time. Try again later.",
  "仓库列表": "Repository list",
  "{login} 的仓库列表": "{login}'s repositories",
  "只读取到了 {n} 个仓库，": "Only {n} repositories were read.",
  "筛选": "Filters",
  "已启用 {n} 个条件": "{n} filters active",
  "全部仓库": "All repositories",
  "清除": "Clear",
  "稀有度": "Rarity",
  "仅沉睡（≥ {n} 天）": "Dormant only (≥ {n} days)",
  "有余烬（≥ {n} 天且 Star ≥ {m}）":
    "With embers (≥ {n} days and ≥ {m} stars)",
  "标签": "Tags",
  "排序": "Sort",
  "悬停查看细节": "Hover for details",
  "没有符合条件的仓库。": "No repository answers these filters.",
  "把筛选条件放宽一点，或者清除全部条件再看一遍。":
    "Loosen the filters, or clear them all and look once more.",
  "清除筛选": "Clear filters",
  "预览": "Preview",
  "沉睡": "Dormant",
  "沉睡天数": "Days dormant",
  "Star 数": "Stars",
  "Star": "Stars",
  "上游": "Upstream",
  "上游仓库": "Upstream repository",
  "把指针放到任意一张卡上，这里会显示它的细节。":
    "Rest your pointer on any card, and its details will appear here.",
  "这个仓库没有写简介。": "This repository has no description.",
  "Fork 数": "Forks",
  "未标注语言": "No language",
  "还有 {n} 个标签：{names}": "More tags ({n}): {names}",
  "读取时间": "Read time",

  /* ---------------------------------------------------------------- */
  /* 榜单页                                                            */
  /* ---------------------------------------------------------------- */
  "榜单数据为 {ago} 前": "Board data is {ago} old.",
  "榜单切换": "Board switcher",
  "有些页没有读到，下面的名次可能不完整。":
    "Some pages could not be read; the ranks below may be incomplete.",
  "刷新": "Refresh",
  "名次仍然是真的，只是这些数据已经不是最新的了。":
    "The ranks are still true; the data is simply no longer the latest.",
  "按沉睡天数排序，列出仓库、印记、沉睡天数与 Star 数。":
    "Sorted by days dormant: repository, sigil, days dormant, and stars.",
  "名次": "Rank",
  "印记": "Sigil",
  "仓库": "Repository",
  "还没有仓库住进来。": "No repository dwells here yet.",
  "把你的一个公开仓库加上 {topic} 主题，它就会出现在这里。":
    "Add the {topic} topic to one of your public repositories and it will appear here.",
  "正在读取榜单…": "Reading the board…",

  /* ---------------------------------------------------------------- */
  /* 分享                                                              */
  /* ---------------------------------------------------------------- */
  "复制失败，请手动选中上面的文字。":
    "Copy failed. Select the text above manually.",
  "分享": "Share",
  "把这份鉴定带走": "Take this reading with you",
  "分享前先看一眼文案。发到哪里、发不发，都由你决定。":
    "Read the text before you share. Where it goes, and whether it goes at all, is yours to decide.",
  "这次没有读到带主题的仓库数，文案里不写数量。你可以先复制页面链接。":
    "The topic-carrying repository count was not read, so the text leaves the number out. You can copy the page link first.",
  "发推": "Post on X",
  "（在新窗口打开 Twitter 撰写窗口）":
    "(opens the X composer in a new window)",
  "已复制分享文案": "Share text copied",
  "复制文案": "Copy text",
  "已复制页面链接": "Page link copied",
  "复制链接": "Copy link",
  "保存图片": "Save image",
  "系统分享": "System share",
  "下载徽章": "Download badge",
  "朋友圈没有网页分享接口：保存这张图，连着文案一起粘贴过去。":
    "WeChat Moments has no web share API: save this image and paste it together with the text.",
  "朋友圈没有网页分享接口：复制文案、下载徽章，再粘贴到朋友圈即可。":
    "WeChat Moments has no web share API: copy the text, download the badge, then paste them into Moments.",
  "我在码之灵龛（Repo Vessel）点亮了 {tier}：{count} 个公开仓库带着 {topic} 主题。":
    "I lit {tier} in Repo Vessel: {count} public repositories carry the {topic} topic.",
  "拿到的徽章：{names}。": "Badges earned: {names}.",
  "无法自动复制，请按住 Ctrl / Cmd + C 复制。":
    "Could not copy automatically. Press Ctrl / Cmd + C to copy.",
  "分享卡片暂时画不出来，结果数据还在。":
    "The share card cannot be drawn right now; your results remain.",

  /* ---------------------------------------------------------------- */
  /* 成就                                                              */
  /* ---------------------------------------------------------------- */
  "带主题的公开仓库达到 {n} 个。":
    "Reach {n} public repositories carrying the topic.",
  "Urn of Repos 成就徽章：紫色灵龛，紫色火光":
    "Urn of Repos achievement badge: a violet vessel with violet flame",
  "Repo Vessel 成就徽章：金色灵龛，绿色火焰":
    "Repo Vessel achievement badge: a golden vessel with green flame",
  "成就徽章": "Achievement badge",
  "这次没有读到带主题的公开仓库数，无法判断成就。":
    "The topic-carrying public repository count could not be read, so achievements cannot be determined.",
  "已达成": "Unlocked",
  "未达成": "Locked",
  "徽章达成即颁发，可以下载，也可以分享。":
    "Badges are awarded the moment they are earned; download or share them.",
  "再收 {n} 个仓库解锁。": "Gather {n} more repositories to unlock.",
  "未知成就：{id}": "Unknown achievement: {id}",

  /* ---------------------------------------------------------------- */
  /* 管理页                                                            */
  /* ---------------------------------------------------------------- */
  "站点的 GitHub 登录还没有配置好。这不是你的问题，请稍后再来。":
    "GitHub sign-in is not configured on this site yet. That is not your fault; please come back later.",
  "你在 GitHub 上取消了授权，所以这次没有完成登录。":
    "You cancelled authorization on GitHub, so sign-in did not complete.",
  "这次登录请求已经过期了。重新点一次登录即可。":
    "This sign-in request has expired. Start the sign-in again.",
  "没能和 GitHub 完成这次登录。稍后再试一次。":
    "Sign-in with GitHub could not be completed. Try again later.",
  "拿到了授权，但没读到你的 GitHub 资料。稍后再试一次。":
    "Authorization succeeded, but your GitHub profile could not be read. Try again later.",
  "本站只支持个人账户。组织账户没法登录，也不会被收录。":
    "This site supports personal accounts only. Organization accounts cannot sign in and are not collected.",
  "我的管理": "My Vessel",
  "没有完成登录。": "Sign-in did not complete.",
  "正在确认登录状态…": "Checking sign-in status…",
  "已登录为 @{login}。": "Signed in as @{login}.",
  "撤销登录": "Sign out",
  "认领只是证明这个仓库是你名下的，它不会让仓库入龛。想让它彻底消失，也可以直接把 GitHub 上的主题去掉，或者走{link}。":
    "A claim only proves the repository is yours; it does not bring it into the vessel. To make it vanish altogether, remove the topic on GitHub, or file a {link}.",
  "用 GitHub 登录后，你可以证明某个已收录的仓库是你名下的。本站只读取你的公开身份，不申请任何仓库读写权限。":
    "Sign in with GitHub to prove that a collected repository is yours. This site reads only your public identity and requests no repository read or write permissions.",
  "用 GitHub 登录": "Sign in with GitHub",
  "无法登录？提交下架申请": "Cannot sign in? File a takedown",
  "正在读取你的认领…": "Reading your claims…",
  "还没有认领任何仓库。": "You have not claimed any repositories yet.",
  "在自己的已收录仓库上认领之后，可以在这里把它隐藏起来。":
    "Claim one of your collected repositories, and you can hide it here.",
  "已隐藏": "Hidden",
  "展示中": "Listed",
  "已不在龛里": "No longer in the vessel",
  " · 核实于 {time}": " · verified {time}",
  "恢复展示": "Restore listing",
  "隐藏": "Hide",
  "它已经不在龛里了（主题被拿掉、转为私有，或账户变成了组织）。认领记录还在，但没有可以恢复的东西。":
    "It is no longer in the vessel (the topic was removed, it became private, or the account became an organization). The claim remains, but there is nothing to restore.",
  "认领一个仓库": "Claim a repository",
  "输入你自己名下的已收录仓库（owner/name）。":
    "Enter a collected repository that is yours (owner/name).",
  "认领": "Claim",
  "认领成功。它已经出现在上面的列表里。":
    "Claimed. It now stands in the list above.",
  "这个仓库不属于当前登录的账户。":
    "This repository does not belong to the signed-in account.",
  "组织账户的仓库不会被收录，也无法认领。":
    "Repositories owned by organizations are not collected and cannot be claimed.",
  "这个仓库不是公开仓库。": "This repository is not public.",
  "这个仓库目前没有被收录。": "This repository is not currently collected.",
  "你还没有认领这个仓库。": "You have not claimed this repository.",
  "请求里要有 hidden 字段（true 或 false）。":
    "The request must include a hidden field (true or false).",
  "仓库名要写成 owner/name。": "Write the repository as owner/name.",

  /* ---------------------------------------------------------------- */
  /* 如何入龛                                                          */
  /* ---------------------------------------------------------------- */
  "一、自己来": "I. By Your Own Hand",
  "在你的任意一个**公开**仓库上加上 {topics} 主题（Settings → Topics），本站就会把它收录进来；核实之后，只有符合榜单条件的仓库才会出现在那个榜单上。主题是公开的、任何人都能看见，所以你随时可以把它拿掉。":
    "Add the {topics} topic to any of your **public** repositories (Settings → Topics), and this site will collect it. After verification, only a repository that meets a board's criteria appears on that board. Topics are public and visible to all, so you may remove one whenever you choose.",
  "二、只是被看了一眼": "II. A Glance Only",
  "查一个用户名是**预览**，不是发布：它不会收录任何仓库，也不会把结果发到任何地方。分享图只有你自己点开，发不发也由你决定。":
    "Looking up a username is a **preview**, not a publication: it enrols no repository and sends the result nowhere. Any share card is one you opened yourself, and sending it stays your decision.",
  "三、只读": "III. Read-Only",
  "本站只读取公开仓库的元数据：最后一次推送时间、Star 数、Fork 数、语言。不读取仓库里的任何文件，不扫描密钥，不修改、归档、删除或同步任何仓库。":
    "This site reads public repository metadata only: last push time, stars, forks, and language. It reads no file within a repository, scans for no secret, and never modifies, archives, deletes, or syncs any repository.",
  "四、随时可以拿走": "IV. Take It Back",
  "把主题拿掉，仓库就会从榜单上消失。如果你已经认领了它，也可以直接把它隐藏 —— 即使主题还在，它也不会再出现。":
    "Remove the topic, and the repository leaves the board. If you have claimed it, you can also hide it outright; even with the topic in place, it will not appear again.",
  "五、本站记什么": "V. What This Site Records",
  "本站只做匿名计数：不保存 IP、浏览器标识、Cookie 或任何用户 ID，也不接第三方统计。计数只到「某一天、某类事件发生了几次」。你的用户名与仓库名不会进入统计。浏览器开启 Do Not Track 或 Global Privacy Control 时，本站不发送任何计数。":
    "This site keeps anonymous counters only: no IP, browser identifier, cookie, or user ID is stored, and no third-party analytics are used. Counts reach only as far as \"on this day, this kind of event happened this many times\". Your username and repository names never enter them. If your browser sends Do Not Track or Global Privacy Control, this site sends no counters at all.",
  "收录状态": "Collection status",
  "查一下收录状态": "Check collection status",
  "输入一个仓库（owner/name），看看它现在在不在龛里，以及为什么。":
    "Enter a repository (owner/name) to learn whether it dwells in the vessel now, and why.",
  "仓库名": "Repository name",
  "上一次查得有点密，等一会儿再试。":
    "That was a little too quick. Wait a moment, then try again.",
  "命中的主题": "Matched topic",
  "最近核实": "Last verified",
  "还没有核实记录": "No verification record yet",
  "本次查询": "This query",
  "查询时间": "Query time",
  "再查一次": "Check again",
  "复制主题：": "Copy topic:",
  "{topic} · 已复制": "{topic} · Copied",

  /* ---------------------------------------------------------------- */
  /* 未知值 / 通用                                                      */
  /* ---------------------------------------------------------------- */
  "这个值": "this value",
  "{label}未知：{reason}": "{label} unknown: {reason}",
  "这个字段": "this field",
  "这个字段在当前语境下没有意义": "this field does not apply here",
  "不适用": "Not applicable",
  "{label}在当前语境下没有意义": "{label} does not apply here",
  "达成即颁发，可以下载，也可以分享":
    "Awarded when earned; download or share it",

  /* ---------------------------------------------------------------- */
  /* 错误                                                              */
  /* ---------------------------------------------------------------- */
  "GitHub 暂时限制了这次读取的频率。稍后再试。":
    "GitHub is limiting this read right now. Try again later.",
  "读取 GitHub 超时了。稍后再试。": "The GitHub read timed out. Try again later.",
  "暂时连不上 GitHub。": "GitHub cannot be reached right now.",
  "没有找到这个 GitHub 账户。": "This GitHub account was not found.",
  "这是一个组织账户。本站只收录个人公开仓库。":
    "This is an organization account. This site collects only public repositories owned by personal accounts.",
  "这个仓库读不到，可能已被删除或转为私有。":
    "This repository could not be read; it may have been deleted or made private.",
  "这个仓库已经不在本站展示了。": "This repository is no longer listed here.",
  "分享卡片暂时画不出来。": "The share card cannot be drawn right now.",
  "登录没有完成。": "Sign-in did not complete.",
  "这次认领没有通过。": "This claim was not accepted.",
  "这个接口还没有上线。": "This endpoint is not available yet.",
  "看起来你现在没有联网。连上网络后再试。":
    "It looks like you are offline. Reconnect and try again.",
  "用户名不太对。GitHub 用户名由字母、数字和单个连字符组成。":
    "That username does not look right. GitHub usernames use letters, digits, and single hyphens.",
  "没有这个榜单。": "No such board.",
  "请求的内容不对。": "The request payload is invalid.",
  "请求的内容太大了。": "The request payload is too large.",
  "站点还没有配置读取 GitHub 用的令牌，暂时读不到数据。":
    "The site has not configured its GitHub read token yet, so data cannot be read.",
  "服务器返回了看不懂的内容。稍后再试。":
    "The server returned something unreadable. Try again later.",
  "用户名不太对。": "The username does not look right.",
  "这个接口只支持 GET。": "This endpoint only supports GET.",
  "这个接口只支持 POST。": "This endpoint only supports POST.",
  "这个地址只支持 GET。": "This address only supports GET.",
  "没有这个分享图。": "No such share image.",
  "静态产物没有绑定。": "Static assets are not bound.",
  "这个请求不是本站发起的。": "This request did not originate from this site.",
  "不认识这个事件。": "Unknown event.",
  "事件的维度不对。": "Invalid event dimension.",
  "这个接口只支持 GET、POST 与 PATCH。":
    "This endpoint only supports GET, POST, and PATCH.",
  "@{login} 的{site}分享卡": "{site} share card for @{login}",

  /* ---------------------------------------------------------------- */
  /* 服务端称号证据                                                     */
  /* ---------------------------------------------------------------- */
  "还没有公开仓库。": "No public repositories yet.",
  "公开仓库少于 {n} 个。": "Fewer than {n} public repositories.",
  "有 {n} 个仓库最后一次推送在三年前或更早。":
    "Last pushed three years ago or earlier: {n}.",
  "有 {n} 个仓库安静了一年以上，仍然有 Star。":
    "Quiet for over a year and still starred: {n}.",
  "{n} 个仓库是 Fork，占公开仓库的 {percent}。":
    "Forks: {n} ({percent} of public repositories).",
  "{n} 个原创仓库，占公开仓库的 {percent}。":
    "Original repositories: {n} ({percent} of public repositories).",
  "公开仓库 {n} 个，其中 Fork {m} 个。":
    "Public repositories: {n}. Forks: {m}.",
};

export const ZH_HANT: Record<string, string> = {
  "码之灵龛": "碼之靈龕",
  "当一个项目在战场上倒下，它的灰烬便会归于此龛。":
    "當一個專案倒於戰場，它的灰燼便歸於此龕。",
  "充能完毕，随时准备为下一个项目注入生命。":
    "充能已畢，隨時為下一個專案注入生命。",
  "码之灵龛 · Repo Vessel": "碼之靈龕 · Repo Vessel",
  "灵龛鉴定 · 沉睡仓库图鉴 · 时光收藏家":
    "靈龕鑑定 · 沉睡儲存庫圖鑑 · 時光收藏家",
  "输入一个 GitHub 用户名，看看你的公开仓库里哪些还在沉睡、哪些 Fork 漂泊去了哪里。":
    "輸入一個 GitHub 使用者名稱，看你哪些公開儲存庫仍在沉睡、哪些 Fork 又漂泊去了何方。",
  "查查我的灵龛": "查查我的靈龕",
  "围观榜单": "圍觀榜單",
  "如何入龛": "如何入龕",
  "GitHub 登录": "GitHub 登入",
  "本站只读取公开仓库的元数据，从不归档、删除、同步、改名或修改任何仓库，也不保存仓库里的任何代码。仓库带上本站的主题即可被收录；仓库主人认领之后，可以把它从榜单上隐藏。":
    "本站僅讀取公開儲存庫的中繼資料，從不封存、刪除、同步、改名或修改任何儲存庫，也不保存其中任何程式碼。儲存庫帶上本站的主題便會被收錄；儲存庫主人認領之後，可以把它的條目從榜單上隱藏。",
  "榜单": "榜單",
  "下架申请": "下架申請",
  "Twitter / X": "Twitter / X",
  "GitHub 仓库": "GitHub 儲存庫",
  "码之灵龛需要 JavaScript 才能运行。没有它，你仍然可以直接访问公开仓库页面。":
    "碼之靈龕需要 JavaScript 才能執行。沒有它，你仍可直接存取公開儲存庫頁面。",
  "带主题仓库": "帶主題儲存庫",
  "最长沉睡": "最長沉睡",
  "读取于": "讀取於",
  "读取于 {time}": "讀取於 {time}",
  "? 未知": "? 未知",
  "语言": "語言",
  "语言偏好": "語言偏好",
  "中文会按浏览器的地区自动选用简体或繁体。":
    "中文會依瀏覽器的地區，自動選用簡體或繁體。",
  "当前显示：{language}": "目前顯示：{language}",
  "偏好没有保存成功，本次浏览仍然使用新语言。":
    "偏好沒有儲存成功，本次瀏覽仍使用新語言。",
  "跳到主要内容": "跳到主要內容",
  "主导航": "主導覽",
  "页脚导航": "頁尾導覽",
  "退出": "登出",
  "处理中…": "處理中…",
  "重试": "重試",
  "或": "或",
  "（新窗口）": "（新視窗）",

  "时间胶囊": "時間膠囊",
  "最后一次推送距今已超过三年。这不代表项目已经失效，它也可能只是被好好收着。":
    "最後一次推送距今已逾三年。這並不代表專案已經失效，它也可能只是被好好收著。",
  "深度待机": "深度待機",
  "按最后推送时间算，这个仓库有一段时间没有变化了。":
    "按最後推送時間計，這個儲存庫已有一段時日沒有變化。",
  "刚刚安静": "剛剛安靜",
  "有一段时间没有推送了。这不代表它停止了维护，只说明最后推送时间在这里。":
    "已有一段時日沒有推送。這不代表維護已然停止，只說明最後一次推送停在此處。",
  "余烬未熄": "餘燼未熄",
  "仓库安静了一段时间，但仍然有人给它点了 Star。Star 数不代表它现在仍在被使用。":
    "儲存庫安靜了一段時日，卻仍有人為它點上 Star。Star 數不代表它此刻仍在被使用。",
  "远行的 Fork": "遠行的 Fork",
  "这是一个 Fork，出发自另一个公开项目。":
    "這是一個 Fork，自另一個公開專案啟程。",
  "已归档": "已封存",
  "GitHub 上这个仓库已被作者归档。这是你在 GitHub 上的状态，本站没有改动它。":
    "此儲存庫已由作者在 GitHub 上封存。這是你於 GitHub 的狀態，本站未曾改動。",

  "时光收藏家": "時光收藏家",
  "有些想法，需要一点时间发酵。": "有些想法，須待時日醞釀。",
  "余烬守护者": "餘燼守護者",
  "安静下来之后，它仍被人记得。": "沉寂之後，仍有人記得它。",
  "Fork 漂流者": "Fork 漂流者",
  "有些项目出发之后，去了别的方向。": "有些專案啟程之後，走上了別的方向。",
  "想法播种者": "想法播種者",
  "播种很多，也留下很多。": "播下許多，也留下許多。",
  "轻装旅人": "輕裝旅人",
  "你的公开仓库看起来相当轻盈。": "你的公開儲存庫，行裝甚輕。",
  "初访者": "初訪者",
  "先看看这里有什么。": "先看看此地有何物。",

  "普通": "普通",
  "还在近处，尚未走远。": "仍在近處，尚未走遠。",
  "稀有": "稀有",
  "沉睡了半年以上，安静地待着。": "沉睡已逾半年，安靜地待著。",
  "史诗": "史詩",
  "沉睡了至少一年，这段时间没有变化。": "沉睡至少一年，這段時日沒有變化。",
  "传说": "傳說",
  "沉睡了至少三年，被好好收着。": "沉睡至少三年，被人好好收著。",

  "未启封": "未啟封",
  "还没有仓库住进来。给一个公开仓库加上主题，它就会住进来。":
    "尚無儲存庫入住。為一個公開儲存庫加上主題，它便會在此安身。",
  "Ⅰ 阶": "Ⅰ 階",
  "灵龛刚点上火。": "靈龕方才點上火。",
  "Ⅱ 阶": "Ⅱ 階",
  "已经攒下一点灰烬。": "已攢下一點灰燼。",
  "Ⅲ 阶": "Ⅲ 階",
  "灰烬积成了堆。": "灰燼已積成堆。",
  "Ⅳ 阶": "Ⅳ 階",
  "阶": "階",
  "灵龛充能等级": "靈龕充能等級",
  "这次没有读到带主题的公开仓库数。":
    "這次沒有讀到帶主題的公開儲存庫數。",
  "再收 {n} 个仓库升到 {tier}。": "再收 {n} 個儲存庫，即可升至 {tier}。",
  "{label} {tier}": "{label} {tier}",

  "GitHub 暂时限制了请求频率，没有读到这个值。":
    "GitHub 暫時限制了請求頻率，此值未能讀到。",
  "读取超时，没有读到这个值。": "讀取逾時，此值未能讀到。",
  "GitHub 没有提供这个值。": "GitHub 未提供此值。",
  "目标暂时无法访问，没有读到这个值。":
    "目標暫時無法存取，此值未能讀到。",
  "这次读取被截断，没有读到这个值。":
    "這次讀取遭到截斷，此值未能讀到。",

  "最长沉睡榜": "最長沉睡榜",
  "它们没有走远，只是很久没有推送。":
    "它們沒有走遠，只是久未推送。",
  "余烬未熄榜": "餘燼未熄榜",
  "有些仓库安静了，星星还亮着。": "有些儲存庫已歸安靜，星光仍亮。",
  "Fork 漂流榜": "Fork 漂流榜",
  "从别处出发，在这里继续走了一段。":
    "自別處啟程，在此續行一程。",
  "收录条件：仓库带有 {topics} 主题，且沉睡 ≥ {days} 天、Star ≥ {stars}。":
    "收錄條件：儲存庫帶有 {topics} 主題，沉睡 ≥ {days} 天，Star ≥ {stars}。",
  "收录条件：仓库带有 {topics} 主题，且是一个 Fork，沉睡 ≥ {days} 天。":
    "收錄條件：儲存庫帶有 {topics} 主題，且為 Fork，沉睡 ≥ {days} 天。",
  "收录条件：仓库带有 {topics} 主题，且沉睡 ≥ {days} 天。":
    "收錄條件：儲存庫帶有 {topics} 主題，沉睡 ≥ {days} 天。",

  "已入龛": "已入龕",
  "这个仓库已经在龛里了。它在哪张榜上出现，取决于沉睡时间与 Star 数。":
    "此儲存庫已在龕中。它歸於哪張榜上，取決於沉睡時日與 Star 數。",
  "待入龛": "待入龕",
  "条件都满足了，下一次收录就会把它收进来。收录每六小时跑一轮。":
    "條件皆已齊備，下一輪收錄便會將它收入。收錄每六小時巡行一次。",
  "还没有主题": "還沒有主題",
  "这个仓库没有带上本站的任何一个主题。加上主题之后，下一轮收录就会收进它。":
    "此儲存庫未帶上本站任何一個主題。加上主題之後，下一輪收錄便會將它收入。",
  "不收录": "不收錄",
  "本站只收录个人账户的公开仓库。组织账户与私有仓库不在收录范围内。":
    "本站只收錄個人帳戶的公開儲存庫。組織帳戶與私有儲存庫，皆不在收錄之列。",
  "这次没能确认": "這次沒能確認",
  "没有读到确定的结果 —— 这不代表它没有主题，也不代表它不合格。稍后再查一次。":
    "沒有讀到確定的結果 —— 這不代表它沒有主題，也不代表它不合格。稍後再查一次。",
  "收录数据暂时读不到。稍后再试。":
    "收錄資料暫時讀不到。稍後再試。",
  "认领记录暂时读不到。稍后再试。":
    "認領記錄暫時讀不到。稍後再試。",
  "暂时确认不了这个仓库的状态，稍后再试。":
    "暫時無法確認此儲存庫的狀態，稍後再試。",

  "已收到": "已收到",
  "已处理": "已處理",
  "未通过": "未通過",
  "工单号": "工單號",
  "已复制": "已複製",
  "复制": "複製",
  "状态": "狀態",
  "提交于": "提交於",
  "更新于": "更新於",
  "提交下架申请": "提交下架申請",
  "说明（可不填）": "說明（可不填）",
  "一句说明就好。": "一句說明即可。",
  "提交申请": "提交申請",
  "下架工单": "下架工單",
  "申请已收到。": "申請已收到。",
  "我们会在这个时限内看一遍：{hours} 小时。把工单号抄下来，凭它可以查状态。":
    "我們會在此時限內過目：{hours} 小時。請抄下工單號，憑號可查狀態。",
  "提交于 {time}。提交不会立刻隐藏仓库 —— 核实之后才会处理。":
    "提交於 {time}。提交不會立刻隱藏儲存庫 —— 核實之後才會處理。",
  "查询工单": "查詢工單",
  "查一下工单": "查一下工單",
  "下架时拿到的工单号": "下架時拿到的工單號",
  "查询": "查詢",
  "你的仓库出现在了榜单上，但你不想让它在这里？不需要 GitHub 登录，也不需要任何账号。":
    "你的儲存庫出現在榜單上，你卻不想讓它留在這裡？無須 GitHub 登入，也無須任何帳號。",
  "提交仓库地址和一句说明即可。我们会核实，然后把这条记录从榜单上撤下来，并且不会把它加回任何榜单。":
    "提交儲存庫位址與一句說明即可。我們會核實，再將這條記錄自榜單撤下，且不會把它加回任何榜單。",
  "不会收集你的邮箱 —— 本站没有回信渠道，收了只会让你以为会有回信。":
    "不會收集你的電子郵件 —— 本站沒有回信管道，收了只會讓你以為會有回信。",
  "请填写仓库地址，例如 owner/name。":
    "請填寫儲存庫位址，例如 owner/name。",
  "下架申请暂时提交不了。稍后再试。":
    "下架申請暫時提交不了。稍後再試。",
  "工单状态暂时查不到。稍后再试。":
    "工單狀態暫時查不到。稍後再試。",
  "没有找到这张工单。": "沒有找到這張工單。",

  "灵龛鉴定": "靈龕鑑定",
  "看看你的仓库里哪些还在沉睡。":
    "看看你的儲存庫裡，哪些還在沉睡。",
  "输入一个 GitHub 用户名，本站只读取公开仓库的元数据：最后一次推送是什么时候、有多少人给它点过 Star、哪些是 Fork、从哪里出发。不会读取仓库里的任何代码，也不会改动你的任何仓库。":
    "輸入一個 GitHub 使用者名稱，本站只讀取公開儲存庫的中繼資料：最後一次推送是何時、多少人為它點過 Star、哪些是 Fork、又從何處啟程。不會讀取儲存庫裡的任何程式碼，也不會改動你的任何儲存庫。",
  "GitHub 用户名": "GitHub 使用者名稱",
  "你的 GitHub 用户名": "你的 GitHub 使用者名稱",
  "开始鉴定": "開始鑑定",
  "围观中的灵龛": "圍觀中的靈龕",
  "这些灵龛正在被打开。你的也可以。":
    "這些靈龕正在被開啟。你的亦然。",
  "最长沉睡天数": "最長沉睡天數",

  "这次没能读到结果。数据还在，你可以稍后再试。":
    "這次沒能讀到結果。資料還在，你可稍後再試。",
  "这是 {ago} 前的数据": "這是 {ago} 前的資料。",
  "沉睡最久": "沉睡最久",
  "余烬最亮": "餘燼最亮",
  "本次结果可能不完整": "本次結果可能不完整",
  "重新读取": "重新讀取",
  "只读取到了前 {n} 个仓库，":
    "只讀取到了前 {n} 個儲存庫，",
  "第 {n} 页没有读到。": "第 {n} 頁未能讀到。",
  "还有一部分没有读到。": "還有一部分未能讀到。",
  "数据仍然真实，只是可能已经过时。":
    "資料仍然為真，只是可能已經過時。",
  "{login} 的灵龛鉴定": "{login} 的靈龕鑑定",
  "仍有余烬": "仍有餘燼",
  "余烬仓库数": "餘燼儲存庫數",
  "{n} 个": "{n} 個",
  "公开 Fork": "公開 Fork",
  "Fork 数量": "Fork 數量",
  "已归档数量": "已封存數量",
  "公开仓库": "公開儲存庫",
  "仓库数量": "儲存庫數量",
  "查看我的仓库": "查看我的儲存庫",
  "去分享": "去分享",
  "三个代表": "三位代表",
  "按沉睡时长、余烬亮度与 Fork 旅程各选一个":
    "按沉睡時長、餘燼亮度與 Fork 旅程，各擇其一。",
  "暂时没有找到这一类仓库。": "暫時沒有找到這一類儲存庫。",
  "后续": "後續",
  "→ 打开完整的仓库列表": "→ 開啟完整的儲存庫列表",
  "正在读取 {login} 的公开仓库…": "正在讀取 {login} 的公開儲存庫…",
  "正在读取…": "正在讀取…",

  "最近推送": "最近推送",
  "Star 最多": "Star 最多",
  "名称": "名稱",
  "这次没能读到仓库列表。稍后再试。":
    "這次沒能讀到儲存庫列表。稍後再試。",
  "仓库列表": "儲存庫列表",
  "{login} 的仓库列表": "{login} 的儲存庫列表",
  "只读取到了 {n} 个仓库，": "只讀取到了 {n} 個儲存庫，",
  "筛选": "篩選",
  "已启用 {n} 个条件": "已啟用 {n} 個條件",
  "全部仓库": "全部儲存庫",
  "清除": "清除",
  "稀有度": "稀有度",
  "仅沉睡（≥ {n} 天）": "僅沉睡（≥ {n} 天）",
  "有余烬（≥ {n} 天且 Star ≥ {m}）":
    "有餘燼（≥ {n} 天且 Star ≥ {m}）",
  "标签": "標籤",
  "排序": "排序",
  "悬停查看细节": "懸停查看細節",
  "没有符合条件的仓库。": "沒有符合條件的儲存庫。",
  "把筛选条件放宽一点，或者清除全部条件再看一遍。":
    "把篩選條件放寬一些，或清除全部條件再看一遍。",
  "清除筛选": "清除篩選",
  "预览": "預覽",
  "沉睡": "沉睡",
  "沉睡天数": "沉睡天數",
  "Star 数": "Star 數",
  "Star": "Star",
  "上游": "上游",
  "上游仓库": "上游儲存庫",
  "把指针放到任意一张卡上，这里会显示它的细节。":
    "將指標移到任一張卡上，這裡便會顯示它的細節。",
  "这个仓库没有写简介。": "此儲存庫沒有寫簡介。",
  "Fork 数": "Fork 數",
  "未标注语言": "未標註語言",
  "还有 {n} 个标签：{names}": "還有 {n} 個標籤：{names}",
  "读取时间": "讀取時間",

  "榜单数据为 {ago} 前": "榜單資料為 {ago} 前",
  "榜单切换": "榜單切換",
  "有些页没有读到，下面的名次可能不完整。":
    "有些頁未能讀到，以下名次可能不完整。",
  "刷新": "重新整理",
  "名次仍然是真的，只是这些数据已经不是最新的了。":
    "名次仍然為真，只是這些資料已非最新。",
  "按沉睡天数排序，列出仓库、印记、沉睡天数与 Star 数。":
    "按沉睡天數排序，列出儲存庫、印記、沉睡天數與 Star 數。",
  "名次": "名次",
  "印记": "印記",
  "仓库": "儲存庫",
  "还没有仓库住进来。": "還沒有儲存庫入住。",
  "把你的一个公开仓库加上 {topic} 主题，它就会出现在这里。":
    "為你的其中一個公開儲存庫加上 {topic} 主題，它便會在此現身。",
  "正在读取榜单…": "正在讀取榜單…",

  "复制失败，请手动选中上面的文字。":
    "複製失敗，請手動選取上方文字。",
  "分享": "分享",
  "把这份鉴定带走": "把這份鑑定帶走",
  "分享前先看一眼文案。发到哪里、发不发，都由你决定。":
    "分享之前，先看一眼文案。發往何處、發或不發，皆由你決定。",
  "这次没有读到带主题的仓库数，文案里不写数量。你可以先复制页面链接。":
    "這次沒有讀到帶主題的儲存庫數，文案中不寫數量。你可以先複製頁面連結。",
  "发推": "發推",
  "（在新窗口打开 Twitter 撰写窗口）":
    "（在新視窗開啟 Twitter 撰寫視窗）",
  "已复制分享文案": "已複製分享文案",
  "复制文案": "複製文案",
  "已复制页面链接": "已複製頁面連結",
  "复制链接": "複製連結",
  "保存图片": "儲存圖片",
  "系统分享": "系統分享",
  "下载徽章": "下載徽章",
  "朋友圈没有网页分享接口：保存这张图，连着文案一起粘贴过去。":
    "朋友圈沒有網頁分享介面：儲存這張圖，連同文案一併貼過去。",
  "朋友圈没有网页分享接口：复制文案、下载徽章，再粘贴到朋友圈即可。":
    "朋友圈沒有網頁分享介面：複製文案、下載徽章，再貼到朋友圈即可。",
  "我在码之灵龛（Repo Vessel）点亮了 {tier}：{count} 个公开仓库带着 {topic} 主题。":
    "我在碼之靈龕（Repo Vessel）點亮了 {tier}：{count} 個公開儲存庫帶著 {topic} 主題。",
  "拿到的徽章：{names}。": "拿到的徽章：{names}。",
  "无法自动复制，请按住 Ctrl / Cmd + C 复制。":
    "無法自動複製，請按住 Ctrl / Cmd + C 複製。",
  "分享卡片暂时画不出来，结果数据还在。":
    "分享卡片暫時畫不出來，結果資料還在。",

  "带主题的公开仓库达到 {n} 个。":
    "帶主題的公開儲存庫達到 {n} 個。",
  "Urn of Repos 成就徽章：紫色灵龛，紫色火光":
    "Urn of Repos 成就徽章：紫色靈龕，紫色火光",
  "Repo Vessel 成就徽章：金色灵龛，绿色火焰":
    "Repo Vessel 成就徽章：金色靈龕，綠色火焰",
  "成就徽章": "成就徽章",
  "这次没有读到带主题的公开仓库数，无法判断成就。":
    "這次沒有讀到帶主題的公開儲存庫數，無法判斷成就。",
  "已达成": "已達成",
  "未达成": "未達成",
  "徽章达成即颁发，可以下载，也可以分享。":
    "徽章達成即頒發，可以下載，也可以分享。",
  "再收 {n} 个仓库解锁。": "再收 {n} 個儲存庫即可解鎖。",
  "未知成就：{id}": "未知成就：{id}",

  "站点的 GitHub 登录还没有配置好。这不是你的问题，请稍后再来。":
    "本站的 GitHub 登入尚未設定妥當。這不是你的問題，請稍後再來。",
  "你在 GitHub 上取消了授权，所以这次没有完成登录。":
    "你在 GitHub 上取消了授權，因此這次未能完成登入。",
  "这次登录请求已经过期了。重新点一次登录即可。":
    "這次登入請求已經過期。重新點一次登入即可。",
  "没能和 GitHub 完成这次登录。稍后再试一次。":
    "未能與 GitHub 完成這次登入。稍後再試一次。",
  "拿到了授权，但没读到你的 GitHub 资料。稍后再试一次。":
    "已取得授權，但未能讀取你的 GitHub 資料。稍後再試一次。",
  "本站只支持个人账户。组织账户没法登录，也不会被收录。":
    "本站只支援個人帳戶。組織帳戶無法登入，也不會被收錄。",
  "我的管理": "我的管理",
  "没有完成登录。": "沒有完成登入。",
  "正在确认登录状态…": "正在確認登入狀態…",
  "已登录为 @{login}。": "已登入為 @{login}。",
  "撤销登录": "撤銷登入",
  "认领只是证明这个仓库是你名下的，它不会让仓库入龛。想让它彻底消失，也可以直接把 GitHub 上的主题去掉，或者走{link}。":
    "認領只證明此儲存庫為你名下所有，不會使它入龕。若要它徹底消失，也可直接移除 GitHub 上的主題，或循{link}。",
  "用 GitHub 登录后，你可以证明某个已收录的仓库是你名下的。本站只读取你的公开身份，不申请任何仓库读写权限。":
    "以 GitHub 登入後，你可以證明某個已收錄的儲存庫為你名下所有。本站只讀取你的公開身分，不申請任何儲存庫讀寫權限。",
  "用 GitHub 登录": "用 GitHub 登入",
  "无法登录？提交下架申请": "無法登入？提交下架申請",
  "正在读取你的认领…": "正在讀取你的認領…",
  "还没有认领任何仓库。": "還沒有認領任何儲存庫。",
  "在自己的已收录仓库上认领之后，可以在这里把它隐藏起来。":
    "在自己的已收錄儲存庫上認領之後，便可以在此將它隱藏。",
  "已隐藏": "已隱藏",
  "展示中": "展示中",
  "已不在龛里": "已不在龕裡",
  " · 核实于 {time}": " · 核實於 {time}",
  "恢复展示": "恢復展示",
  "隐藏": "隱藏",
  "它已经不在龛里了（主题被拿掉、转为私有，或账户变成了组织）。认领记录还在，但没有可以恢复的东西。":
    "它已不在龕中（主題被移除、轉為私有，或帳戶變成了組織）。認領記錄仍在，但已無可恢復之物。",
  "认领一个仓库": "認領一個儲存庫",
  "输入你自己名下的已收录仓库（owner/name）。":
    "輸入你自己名下的已收錄儲存庫（owner/name）。",
  "认领": "認領",
  "认领成功。它已经出现在上面的列表里。":
    "認領成功。它已出現在上方的列表中。",
  "这个仓库不属于当前登录的账户。":
    "此儲存庫不屬於目前登入的帳戶。",
  "组织账户的仓库不会被收录，也无法认领。":
    "組織帳戶的儲存庫不會被收錄，也無法認領。",
  "这个仓库不是公开仓库。": "此儲存庫不是公開儲存庫。",
  "这个仓库目前没有被收录。": "此儲存庫目前沒有被收錄。",
  "你还没有认领这个仓库。": "你還沒有認領此儲存庫。",
  "请求里要有 hidden 字段（true 或 false）。":
    "請求中須有 hidden 欄位（true 或 false）。",
  "仓库名要写成 owner/name。": "儲存庫名要寫成 owner/name。",

  "一、自己来": "一、自己來",
  "在你的任意一个**公开**仓库上加上 {topics} 主题（Settings → Topics），本站就会把它收录进来；核实之后，只有符合榜单条件的仓库才会出现在那个榜单上。主题是公开的、任何人都能看见，所以你随时可以把它拿掉。":
    "在你的任意一個**公開**儲存庫上加上 {topics} 主題（Settings → Topics），本站便會將它收錄進來；核實之後，只有符合榜單條件的儲存庫才會出現在該榜單上。主題是公開的，任何人都看得見，因此你隨時可以將它移除。",
  "二、只是被看了一眼": "二、只是被看了一眼",
  "查一个用户名是**预览**，不是发布：它不会收录任何仓库，也不会把结果发到任何地方。分享图只有你自己点开，发不发也由你决定。":
    "查一個使用者名稱是**預覽**，不是發布：它不會收錄任何儲存庫，也不會把結果送到任何地方。分享圖只有你自己點開，送不送出去也由你決定。",
  "三、只读": "三、唯讀",
  "本站只读取公开仓库的元数据：最后一次推送时间、Star 数、Fork 数、语言。不读取仓库里的任何文件，不扫描密钥，不修改、归档、删除或同步任何仓库。":
    "本站只讀取公開儲存庫的中繼資料：最後一次推送時間、Star 數、Fork 數、語言。不讀取儲存庫裡的任何檔案，不掃描金鑰，不修改、封存、刪除或同步任何儲存庫。",
  "四、随时可以拿走": "四、隨時可以拿走",
  "把主题拿掉，仓库就会从榜单上消失。如果你已经认领了它，也可以直接把它隐藏 —— 即使主题还在，它也不会再出现。":
    "移除主題，儲存庫便會自榜單消失。若你已認領它，也可以直接將它隱藏 —— 即使主題仍在，它也不會再出現。",
  "五、本站记什么": "五、本站記什麼",
  "本站只做匿名计数：不保存 IP、浏览器标识、Cookie 或任何用户 ID，也不接第三方统计。计数只到「某一天、某类事件发生了几次」。你的用户名与仓库名不会进入统计。浏览器开启 Do Not Track 或 Global Privacy Control 时，本站不发送任何计数。":
    "本站只做匿名計數：不保存 IP、瀏覽器識別碼、Cookie 或任何使用者 ID，也不接第三方統計。計數只到「某一天、某類事件發生了幾次」。你的使用者名稱與儲存庫名不會進入統計。瀏覽器開啟 Do Not Track 或 Global Privacy Control 時，本站不發送任何計數。",
  "收录状态": "收錄狀態",
  "查一下收录状态": "查一下收錄狀態",
  "输入一个仓库（owner/name），看看它现在在不在龛里，以及为什么。":
    "輸入一個儲存庫（owner/name），看看它此刻在不在龕中，以及緣由。",
  "仓库名": "儲存庫名",
  "上一次查得有点密，等一会儿再试。":
    "上一次查得有點密，請稍候再試。",
  "命中的主题": "命中的主題",
  "最近核实": "最近核實",
  "还没有核实记录": "還沒有核實記錄",
  "本次查询": "本次查詢",
  "查询时间": "查詢時間",
  "再查一次": "再查一次",
  "复制主题：": "複製主題：",
  "{topic} · 已复制": "{topic} · 已複製",

  "这个值": "這個值",
  "{label}未知：{reason}": "{label}未知：{reason}",
  "这个字段": "這個欄位",
  "这个字段在当前语境下没有意义": "這個欄位在目前語境下沒有意義",
  "不适用": "不適用",
  "{label}在当前语境下没有意义": "{label}在目前語境下沒有意義",
  "达成即颁发，可以下载，也可以分享":
    "達成即頒發，可以下載，也可以分享",

  "GitHub 暂时限制了这次读取的频率。稍后再试。":
    "GitHub 暫時限制了這次讀取的頻率。稍後再試。",
  "读取 GitHub 超时了。稍后再试。": "讀取 GitHub 逾時。稍後再試。",
  "暂时连不上 GitHub。": "暫時連不上 GitHub。",
  "没有找到这个 GitHub 账户。": "沒有找到這個 GitHub 帳戶。",
  "这是一个组织账户。本站只收录个人公开仓库。":
    "這是一個組織帳戶。本站只收錄個人的公開儲存庫。",
  "这个仓库读不到，可能已被删除或转为私有。":
    "此儲存庫讀不到，可能已被刪除或轉為私有。",
  "这个仓库已经不在本站展示了。": "此儲存庫已不在本站展示。",
  "分享卡片暂时画不出来。": "分享卡片暫時畫不出來。",
  "登录没有完成。": "登入沒有完成。",
  "这次认领没有通过。": "這次認領沒有通過。",
  "这个接口还没有上线。": "這個介面還沒有上線。",
  "看起来你现在没有联网。连上网络后再试。":
    "看起來你現在沒有連上網路。連上網路後再試。",
  "用户名不太对。GitHub 用户名由字母、数字和单个连字符组成。":
    "使用者名稱不太對。GitHub 使用者名稱由字母、數字與單一連字號組成。",
  "没有这个榜单。": "沒有這個榜單。",
  "请求的内容不对。": "請求的內容不對。",
  "请求的内容太大了。": "請求的內容太大。",
  "站点还没有配置读取 GitHub 用的令牌，暂时读不到数据。":
    "本站尚未設定讀取 GitHub 所用的權杖，暫時讀不到資料。",
  "服务器返回了看不懂的内容。稍后再试。":
    "伺服器傳回了看不懂的內容。稍後再試。",
  "用户名不太对。": "使用者名稱不太對。",
  "这个接口只支持 GET。": "這個介面只支援 GET。",
  "这个接口只支持 POST。": "這個介面只支援 POST。",
  "这个地址只支持 GET。": "這個位址只支援 GET。",
  "没有这个分享图。": "沒有這個分享圖。",
  "静态产物没有绑定。": "靜態產物沒有綁定。",
  "这个请求不是本站发起的。": "這個請求不是本站發起的。",
  "不认识这个事件。": "不認識這個事件。",
  "事件的维度不对。": "事件的維度不對。",
  "这个接口只支持 GET、POST 与 PATCH。":
    "這個介面只支援 GET、POST 與 PATCH。",
  "@{login} 的{site}分享卡": "@{login} 的{site}分享卡",

  "还没有公开仓库。": "還沒有公開儲存庫。",
  "公开仓库少于 {n} 个。": "公開儲存庫少於 {n} 個。",
  "有 {n} 个仓库最后一次推送在三年前或更早。":
    "有 {n} 個儲存庫的最後一次推送在三年前或更早。",
  "有 {n} 个仓库安静了一年以上，仍然有 Star。":
    "有 {n} 個儲存庫安靜了一年以上，仍有人留下 Star。",
  "{n} 个仓库是 Fork，占公开仓库的 {percent}。":
    "{n} 個儲存庫為 Fork，佔公開儲存庫的 {percent}。",
  "{n} 个原创仓库，占公开仓库的 {percent}。":
    "{n} 個原創儲存庫，佔公開儲存庫的 {percent}。",
  "公开仓库 {n} 个，其中 Fork {m} 个。":
    "公開儲存庫 {n} 個，其中 Fork {m} 個。",
};

export const JA: Record<string, string> = {
  "码之灵龛": "コードの霊龕",
  "当一个项目在战场上倒下，它的灰烬便会归于此龛。":
    "戦場に倒れたプロジェクトの灰燼は、この霊龕へ帰る。",
  "充能完毕，随时准备为下一个项目注入生命。":
    "充填は成った。次のプロジェクトへ命を吹き込む、その時を待つ。",
  "码之灵龛 · Repo Vessel": "コードの霊龕 · Repo Vessel",
  "灵龛鉴定 · 沉睡仓库图鉴 · 时光收藏家":
    "霊龕鑑定 · 眠れるリポジトリの図鑑 · 時の蒐集家",
  "输入一个 GitHub 用户名，看看你的公开仓库里哪些还在沉睡、哪些 Fork 漂泊去了哪里。":
    "GitHub のユーザー名をひとつ。公開リポジトリのうち、いずれが眠りにつき、いずれの Fork がどこへ流れ着いたのかを映す。",
  "查查我的灵龛": "我が霊龕を開く",
  "围观榜单": "ランキング",
  "如何入龛": "入龕の儀",
  "GitHub 登录": "GitHub でログイン",
  "本站只读取公开仓库的元数据，从不归档、删除、同步、改名或修改任何仓库，也不保存仓库里的任何代码。仓库带上本站的主题即可被收录；仓库主人认领之后，可以把它从榜单上隐藏。":
    "本サイトが読むのは、公開リポジトリのメタデータのみ。アーカイブ、削除、同期、改名、変更のいずれも行わず、リポジトリ内のコードも保存しない。リポジトリは本サイトのトピックを宿すことで収録され、所有者が登録した後は、ランキングから隠すことができる。",
  "榜单": "ランキング",
  "下架申请": "掲載停止申請",
  "Twitter / X": "Twitter / X",
  "GitHub 仓库": "GitHub リポジトリ",
  "码之灵龛需要 JavaScript 才能运行。没有它，你仍然可以直接访问公开仓库页面。":
    "コードの霊龕は JavaScript を要する。これがなくとも、公開リポジトリのページへは直接アクセスできる。",
  "带主题仓库": "テーマ付き",
  "最长沉睡": "最長休眠",
  "读取于": "取得日時",
  "读取于 {time}": "{time} に取得",
  "? 未知": "? 不明",
  "语言": "言語",
  "语言偏好": "表示言語",
  "中文会按浏览器的地区自动选用简体或繁体。":
    "中国語はブラウザの地域に合わせ、簡体字か繁体字かを自動で選ぶ。",
  "当前显示：{language}": "表示中：{language}",
  "偏好没有保存成功，本次浏览仍然使用新语言。":
    "言語設定を保存できなかった。この閲覧では新しい言語のまま表示される。",
  "跳到主要内容": "メインコンテンツへスキップ",
  "主导航": "メインナビゲーション",
  "页脚导航": "フッターナビゲーション",
  "退出": "ログアウト",
  "处理中…": "処理中…",
  "重试": "再試行",
  "或": "または",
  "（新窗口）": "（新しいウィンドウ）",

  "时间胶囊": "時の匣",
  "最后一次推送距今已超过三年。这不代表项目已经失效，它也可能只是被好好收着。":
    "最後のプッシュから三年が過ぎた。プロジェクトが終わった証ではなく、ただ丁重に仕舞われているのかもしれない。",
  "深度待机": "深き休眠",
  "按最后推送时间算，这个仓库有一段时间没有变化了。":
    "最後のプッシュ以来、このリポジトリはしばらく動いていない。",
  "刚刚安静": "静寂の訪れ",
  "有一段时间没有推送了。这不代表它停止了维护，只说明最后推送时间在这里。":
    "しばらくプッシュはない。整備が止んだ証ではなく、最後のプッシュがここにある、というだけだ。",
  "余烬未熄": "残り火、未だ消えず",
  "仓库安静了一段时间，但仍然有人给它点了 Star。Star 数不代表它现在仍在被使用。":
    "リポジトリは静かになった。だが星は今も灯る。Star の数は、今も使われている証ではない。",
  "远行的 Fork": "旅する Fork",
  "这是一个 Fork，出发自另一个公开项目。":
    "これは、別の公開プロジェクトから旅立った Fork である。",
  "已归档": "アーカイブ済み",
  "GitHub 上这个仓库已被作者归档。这是你在 GitHub 上的状态，本站没有改动它。":
    "GitHub 上で作者がこのリポジトリをアーカイブした。それは GitHub 側の状態であり、本サイトは何も変えていない。",

  "时光收藏家": "時の蒐集家",
  "有些想法，需要一点时间发酵。": "着想のいくつかは、熟成の時を要する。",
  "余烬守护者": "残り火の守り手",
  "安静下来之后，它仍被人记得。": "静けさに沈んだ後も、それは誰かに憶えられている。",
  "Fork 漂流者": "Fork の漂流者",
  "有些项目出发之后，去了别的方向。":
    "旅立ったプロジェクトは、別の道を選ぶことがある。",
  "想法播种者": "着想の蒔き手",
  "播种很多，也留下很多。": "多くを蒔き、多くを遺した。",
  "轻装旅人": "軽装の旅人",
  "你的公开仓库看起来相当轻盈。":
    "あなたの公開リポジトリは、実に身軽である。",
  "初访者": "初訪者",
  "先看看这里有什么。": "まずは、ここに何が眠るかを見よ。",

  "普通": "一般",
  "还在近处，尚未走远。": "まだ近くにある。遠くへは行っていない。",
  "稀有": "稀少",
  "沉睡了半年以上，安静地待着。":
    "半年あまりを眠り、静かに佇む。",
  "史诗": "史詩",
  "沉睡了至少一年，这段时间没有变化。":
    "一年を超えて眠り、その間は何ひとつ変わらなかった。",
  "传说": "伝説",
  "沉睡了至少三年，被好好收着。":
    "三年を超えて眠り、丁重に仕舞われている。",

  "未启封": "未開封",
  "还没有仓库住进来。给一个公开仓库加上主题，它就会住进来。":
    "いまだリポジトリは宿らず。公開リポジトリにトピックを付せば、この霊龕に住まう。",
  "Ⅰ 阶": "第Ⅰ階",
  "灵龛刚点上火。": "霊龕に火が灯されたばかり。",
  "Ⅱ 阶": "第Ⅱ階",
  "已经攒下一点灰烬。": "灰燼が、わずかに積もった。",
  "Ⅲ 阶": "第Ⅲ階",
  "灰烬积成了堆。": "灰燼は、もはや山を成した。",
  "Ⅳ 阶": "第Ⅳ階",
  "阶": "階",
  "灵龛充能等级": "霊龕チャージ",
  "这次没有读到带主题的公开仓库数。":
    "今回、トピック付き公開リポジトリの数は読めなかった。",
  "再收 {n} 个仓库升到 {tier}。": "あと {n} 個のリポジトリで {tier} に昇る。",
  "{label} {tier}": "{label} {tier}",

  "GitHub 暂时限制了请求频率，没有读到这个值。":
    "GitHub が一時的に要求の頻度を制限した。この値は読めていない。",
  "读取超时，没有读到这个值。":
    "読み取りがタイムアウトした。この値は読めていない。",
  "GitHub 没有提供这个值。": "GitHub はこの値を与えなかった。",
  "目标暂时无法访问，没有读到这个值。":
    "対象に一時、到達できなかった。この値は読めていない。",
  "这次读取被截断，没有读到这个值。":
    "今回の読み取りは途切れた。この値は読めていない。",

  "最长沉睡榜": "最長休眠ランキング",
  "它们没有走远，只是很久没有推送。":
    "彼らは遠くへ行ったのではない。ただ、長くプッシュを絶っているだけだ。",
  "余烬未熄榜": "残り火ランキング",
  "有些仓库安静了，星星还亮着。":
    "静まったリポジトリにも、星はなお灯っている。",
  "Fork 漂流榜": "Fork 漂流ランキング",
  "从别处出发，在这里继续走了一段。":
    "別の場所から旅立ち、ここでしばらく歩を進めた。",
  "收录条件：仓库带有 {topics} 主题，且沉睡 ≥ {days} 天、Star ≥ {stars}。":
    "収録条件：{topics} トピックを宿し、休眠 {days} 日以上、Star {stars} 以上。",
  "收录条件：仓库带有 {topics} 主题，且是一个 Fork，沉睡 ≥ {days} 天。":
    "収録条件：{topics} トピックを宿す Fork にして、休眠 {days} 日以上。",
  "收录条件：仓库带有 {topics} 主题，且沉睡 ≥ {days} 天。":
    "収録条件：{topics} トピックを宿し、休眠 {days} 日以上。",

  "已入龛": "入龕済み",
  "这个仓库已经在龛里了。它在哪张榜上出现，取决于沉睡时间与 Star 数。":
    "このリポジトリはすでに霊龕にある。いずれのランキングに現れるかは、休眠の長さと Star の数が決める。",
  "待入龛": "入龕待ち",
  "条件都满足了，下一次收录就会把它收进来。收录每六小时跑一轮。":
    "条件はすべて満たされた。次の収録がこれを迎え入れる。収録は六時間ごとに巡る。",
  "还没有主题": "トピックなし",
  "这个仓库没有带上本站的任何一个主题。加上主题之后，下一轮收录就会收进它。":
    "このリポジトリは本サイトのトピックをひとつも宿していない。トピックを付せば、次の収録が迎え入れる。",
  "不收录": "対象外",
  "本站只收录个人账户的公开仓库。组织账户与私有仓库不在收录范围内。":
    "本サイトは個人アカウントの公開リポジトリのみを収録する。組織アカウントと非公開リポジトリは対象外だ。",
  "这次没能确认": "今回は確認できず",
  "没有读到确定的结果 —— 这不代表它没有主题，也不代表它不合格。稍后再查一次。":
    "確たる結果は読めなかった。これはトピックがない証でも、条件を満たさない証でもない。時を置いて、もう一度確かめよ。",
  "收录数据暂时读不到。稍后再试。":
    "収集データを今は取得できません。後でもう一度お試しください。",
  "认领记录暂时读不到。稍后再试。":
    "登録記録を今は取得できません。後でもう一度お試しください。",
  "暂时确认不了这个仓库的状态，稍后再试。":
    "このリポジトリの状態を今は確認できません。後でもう一度お試しください。",

  "已收到": "受付済み",
  "已处理": "対応済み",
  "未通过": "却下",
  "工单号": "チケット番号",
  "已复制": "コピーしました",
  "复制": "コピー",
  "状态": "状態",
  "提交于": "受付日時",
  "更新于": "更新日時",
  "提交下架申请": "掲載停止申請を送る",
  "说明（可不填）": "説明（任意）",
  "一句说明就好。": "一言で足りる。",
  "提交申请": "申請を送る",
  "下架工单": "掲載停止チケット",
  "申请已收到。": "申請は受け取った。",
  "我们会在这个时限内看一遍：{hours} 小时。把工单号抄下来，凭它可以查状态。":
    "この時限のうちに目を通す：{hours} 時間。チケット番号を控えよ。それで状態を確かめられる。",
  "提交于 {time}。提交不会立刻隐藏仓库 —— 核实之后才会处理。":
    "{time} に受付。申請はすぐにリポジトリを隠すものではない —— 確認の後、はじめて処理される。",
  "查询工单": "チケットを確認",
  "查一下工单": "チケットを確認",
  "下架时拿到的工单号": "掲載停止時に受け取ったチケット番号",
  "查询": "確認",
  "你的仓库出现在了榜单上，但你不想让它在这里？不需要 GitHub 登录，也不需要任何账号。":
    "あなたのリポジトリがランキングに載っている。だが、ここに置きたくない？GitHub ログインも、アカウントも要らない。",
  "提交仓库地址和一句说明即可。我们会核实，然后把这条记录从榜单上撤下来，并且不会把它加回任何榜单。":
    "リポジトリのアドレスと一言を送るだけでよい。こちらで確認のうえ、その記録をランキングから取り下げる。どのランキングにも二度と戻さない。",
  "不会收集你的邮箱 —— 本站没有回信渠道，收了只会让你以为会有回信。":
    "メールアドレスは蒐めない —— 本サイトに返信の道はなく、預かれば返信があると誤解させるだけだ。",
  "请填写仓库地址，例如 owner/name。":
    "リポジトリのアドレスを入力してください（例：owner/name）。",
  "下架申请暂时提交不了。稍后再试。":
    "掲載停止申請を今は送信できません。後でもう一度お試しください。",
  "工单状态暂时查不到。稍后再试。":
    "チケットの状態を今は確認できません。後でもう一度お試しください。",
  "没有找到这张工单。": "このチケットは見つかりません。",

  "灵龛鉴定": "霊龕鑑定",
  "看看你的仓库里哪些还在沉睡。":
    "あなたのリポジトリのうち、いずれがなお眠るかを見よ。",
  "输入一个 GitHub 用户名，本站只读取公开仓库的元数据：最后一次推送是什么时候、有多少人给它点过 Star、哪些是 Fork、从哪里出发。不会读取仓库里的任何代码，也不会改动你的任何仓库。":
    "GitHub ユーザー名をひとつ。本サイトが読むのは公開リポジトリのメタデータのみ：最後のプッシュはいつか、いくつの Star を宿すか、いずれが Fork か、どこから旅立ったか。リポジトリ内のコードは一切読まず、あなたのリポジトリを何ひとつ変えない。",
  "GitHub 用户名": "GitHub ユーザー名",
  "你的 GitHub 用户名": "GitHub ユーザー名を入力",
  "开始鉴定": "鑑定を始める",
  "围观中的灵龛": "いま開かれゆく霊龕",
  "这些灵龛正在被打开。你的也可以。":
    "これらの霊龕はいま開かれんとする。あなたの霊龕も、また。",
  "最长沉睡天数": "最長休眠日数",

  "这次没能读到结果。数据还在，你可以稍后再试。":
    "今回は結果を読めなかった。データはなお在る。時を置いて、もう一度試されよ。",
  "这是 {ago} 前的数据": "このデータは {ago} 前のものです。",
  "沉睡最久": "最長の眠り",
  "余烬最亮": "最も明るき残り火",
  "本次结果可能不完整": "今回の結果は不完全な可能性があります",
  "重新读取": "読み直す",
  "只读取到了前 {n} 个仓库，":
    "最初の {n} 個のリポジトリしか読めず、",
  "第 {n} 页没有读到。": "{n} ページ目が読めなかった。",
  "还有一部分没有读到。": "一部はなお読めていない。",
  "数据仍然真实，只是可能已经过时。":
    "データはなお事実。ただ、古びているやもしれない。",
  "{login} 的灵龛鉴定": "{login} の霊龕鑑定",
  "仍有余烬": "残り火あり",
  "余烬仓库数": "残り火リポジトリ数",
  "{n} 个": "{n} 個",
  "公开 Fork": "公開 Fork",
  "Fork 数量": "Fork 数",
  "已归档数量": "アーカイブ数",
  "公开仓库": "公開リポジトリ",
  "仓库数量": "リポジトリ数",
  "查看我的仓库": "我がリポジトリを見る",
  "去分享": "共有する",
  "三个代表": "三つの代表",
  "按沉睡时长、余烬亮度与 Fork 旅程各选一个":
    "眠りの長さ、残り火の明るさ、Fork の旅路 —— それぞれにひとつ。",
  "暂时没有找到这一类仓库。": "この類のリポジトリは、いまは見当たらない。",
  "后续": "次へ",
  "→ 打开完整的仓库列表": "→ リポジトリの全一覧を開く",
  "正在读取 {login} 的公开仓库…": "{login} の公開リポジトリを読み取り中…",
  "正在读取…": "読み取り中…",

  "最近推送": "直近のプッシュ",
  "Star 最多": "Star 順",
  "名称": "名前",
  "这次没能读到仓库列表。稍后再试。":
    "今回はリポジトリ一覧を取得できませんでした。後でもう一度お試しください。",
  "仓库列表": "リポジトリ一覧",
  "{login} 的仓库列表": "{login} のリポジトリ",
  "只读取到了 {n} 个仓库，": "{n} 個のリポジトリしか読めず、",
  "筛选": "絞り込み",
  "已启用 {n} 个条件": "{n} 件の条件を適用中",
  "全部仓库": "すべてのリポジトリ",
  "清除": "クリア",
  "稀有度": "レアリティ",
  "仅沉睡（≥ {n} 天）": "休眠のみ（{n} 日以上）",
  "有余烬（≥ {n} 天且 Star ≥ {m}）":
    "残り火あり（{n} 日以上、Star {m} 以上）",
  "标签": "タグ",
  "排序": "並び順",
  "悬停查看细节": "カーソルで詳細",
  "没有符合条件的仓库。": "条件に合うリポジトリはない。",
  "把筛选条件放宽一点，或者清除全部条件再看一遍。":
    "条件を緩めるか、すべて外して、もう一度見よ。",
  "清除筛选": "絞り込みを解除",
  "预览": "プレビュー",
  "沉睡": "休眠",
  "沉睡天数": "休眠日数",
  "Star 数": "Star 数",
  "Star": "Star",
  "上游": "上流",
  "上游仓库": "上流リポジトリ",
  "把指针放到任意一张卡上，这里会显示它的细节。":
    "任意のカードにポインターを重ねよ。ここにその詳細が現れる。",
  "这个仓库没有写简介。": "このリポジトリに説明はない。",
  "Fork 数": "Fork 数",
  "未标注语言": "言語未設定",
  "还有 {n} 个标签：{names}": "ほかに {n} 個のタグ：{names}",
  "读取时间": "取得時刻",

  "榜单数据为 {ago} 前": "ランキングデータは {ago} 前のもの",
  "榜单切换": "ランキング切り替え",
  "有些页没有读到，下面的名次可能不完整。":
    "一部のページを読み取れず、以下の順位は不完全な可能性があります。",
  "刷新": "更新",
  "名次仍然是真的，只是这些数据已经不是最新的了。":
    "順位はなお事実。ただ、このデータはもはや最新ではない。",
  "按沉睡天数排序，列出仓库、印记、沉睡天数与 Star 数。":
    "休眠日数の順に、リポジトリ、印、休眠日数、Star 数を並べる。",
  "名次": "順位",
  "印记": "印",
  "仓库": "リポジトリ",
  "还没有仓库住进来。": "まだリポジトリは宿っていない。",
  "把你的一个公开仓库加上 {topic} 主题，它就会出现在这里。":
    "公開リポジトリのひとつに {topic} トピックを付せば、ここに現れる。",
  "正在读取榜单…": "ランキングを読み取り中…",

  "复制失败，请手动选中上面的文字。":
    "コピーできませんでした。上のテキストを手動で選択してください。",
  "分享": "共有",
  "把这份鉴定带走": "この鑑定を持ち帰る",
  "分享前先看一眼文案。发到哪里、发不发，都由你决定。":
    "共有の前に、文面をひと目見よ。どこへ送るか、送るか否かは、あなたが決める。",
  "这次没有读到带主题的仓库数，文案里不写数量。你可以先复制页面链接。":
    "今回はトピック付きリポジトリの数を読めなかった。ゆえに文面に数は載せない。まずはページのリンクをコピーするとよい。",
  "发推": "X に投稿",
  "（在新窗口打开 Twitter 撰写窗口）":
    "（新しいウィンドウで X の投稿画面を開きます）",
  "已复制分享文案": "共有文面をコピーしました",
  "复制文案": "文面をコピー",
  "已复制页面链接": "ページリンクをコピーしました",
  "复制链接": "リンクをコピー",
  "保存图片": "画像を保存",
  "系统分享": "システム共有",
  "下载徽章": "バッジをダウンロード",
  "朋友圈没有网页分享接口：保存这张图，连着文案一起粘贴过去。":
    "WeChat のモーメンツに Web 共有 API はない。この画像を保存し、文面とともに貼り付けよ。",
  "朋友圈没有网页分享接口：复制文案、下载徽章，再粘贴到朋友圈即可。":
    "WeChat のモーメンツに Web 共有 API はない。文面をコピーし、バッジをダウンロードして、そのまま貼り付けよ。",
  "我在码之灵龛（Repo Vessel）点亮了 {tier}：{count} 个公开仓库带着 {topic} 主题。":
    "コードの霊龕（Repo Vessel）にて、{tier} を灯した。{count} 個の公開リポジトリが {topic} トピックを宿している。",
  "拿到的徽章：{names}。": "得たる徽章：{names}。",
  "无法自动复制，请按住 Ctrl / Cmd + C 复制。":
    "自動コピーできませんでした。Ctrl / Cmd + C でコピーしてください。",
  "分享卡片暂时画不出来，结果数据还在。":
    "共有カードを今は描画できません。結果データはそのまま残っています。",

  "带主题的公开仓库达到 {n} 个。":
    "トピック付きの公開リポジトリ、{n} 個に到達。",
  "Urn of Repos 成就徽章：紫色灵龛，紫色火光":
    "Urn of Repos 実績バッジ：紫の霊龕と紫の炎",
  "Repo Vessel 成就徽章：金色灵龛，绿色火焰":
    "Repo Vessel 実績バッジ：黄金の霊龕と緑の炎",
  "成就徽章": "実績バッジ",
  "这次没有读到带主题的公开仓库数，无法判断成就。":
    "トピック付き公開リポジトリ数を取得できず、実績を判定できません。",
  "已达成": "達成",
  "未达成": "未達成",
  "徽章达成即颁发，可以下载，也可以分享。":
    "バッジは達成と同時に授けられる。ダウンロードも共有も自在。",
  "再收 {n} 个仓库解锁。": "あと {n} 個のリポジトリで解禁。",
  "未知成就：{id}": "不明な実績：{id}",

  "站点的 GitHub 登录还没有配置好。这不是你的问题，请稍后再来。":
    "サイトの GitHub ログインはまだ設定されていません。あなたの問題ではありません。後でもう一度お越しください。",
  "你在 GitHub 上取消了授权，所以这次没有完成登录。":
    "GitHub 上で認可が取り消されたため、ログインが完了しませんでした。",
  "这次登录请求已经过期了。重新点一次登录即可。":
    "このログイン要求は期限切れです。もう一度ログインしてください。",
  "没能和 GitHub 完成这次登录。稍后再试一次。":
    "GitHub とのログインを完了できませんでした。後でもう一度お試しください。",
  "拿到了授权，但没读到你的 GitHub 资料。稍后再试一次。":
    "認可は得られましたが、GitHub プロフィールを取得できませんでした。後でもう一度お試しください。",
  "本站只支持个人账户。组织账户没法登录，也不会被收录。":
    "本サイトは個人アカウントのみ対応しています。組織アカウントはログインできず、収集対象にもなりません。",
  "我的管理": "我が霊龕",
  "没有完成登录。": "ログインが完了していません。",
  "正在确认登录状态…": "ログイン状態を確認中…",
  "已登录为 @{login}。": "@{login} としてログイン中。",
  "撤销登录": "ログアウト",
  "认领只是证明这个仓库是你名下的，它不会让仓库入龛。想让它彻底消失，也可以直接把 GitHub 上的主题去掉，或者走{link}。":
    "登録は、このリポジトリがあなたのものであると示すだけ。霊龕へ入れるものではない。完全に消したいなら、GitHub 上のトピックを外すか、{link}を用いよ。",
  "用 GitHub 登录后，你可以证明某个已收录的仓库是你名下的。本站只读取你的公开身份，不申请任何仓库读写权限。":
    "GitHub でログインすれば、収録済みのリポジトリがあなたのものであると証明できる。本サイトが読むのは公開の身分のみ。リポジトリの読み書き権限は請わない。",
  "用 GitHub 登录": "GitHub でログイン",
  "无法登录？提交下架申请": "ログインできない？掲載停止申請へ",
  "正在读取你的认领…": "登録を読み取り中…",
  "还没有认领任何仓库。": "まだどのリポジトリも登録していない。",
  "在自己的已收录仓库上认领之后，可以在这里把它隐藏起来。":
    "自分の収録済みリポジトリを登録すれば、ここでそれを隠せる。",
  "已隐藏": "非表示",
  "展示中": "表示中",
  "已不在龛里": "霊龕の中にない",
  " · 核实于 {time}": " · {time} に確認",
  "恢复展示": "表示を戻す",
  "隐藏": "非表示にする",
  "它已经不在龛里了（主题被拿掉、转为私有，或账户变成了组织）。认领记录还在，但没有可以恢复的东西。":
    "それはもう霊龕にない（トピックが外れたか、非公開になったか、アカウントが組織になった）。登録の記録は残るが、戻すべきものはない。",
  "认领一个仓库": "リポジトリを登録",
  "输入你自己名下的已收录仓库（owner/name）。":
    "自分が所有する収集済みリポジトリを入力してください（owner/name）。",
  "认领": "登録",
  "认领成功。它已经出现在上面的列表里。":
    "登録は成った。すでに上の一覧にその姿がある。",
  "这个仓库不属于当前登录的账户。":
    "このリポジトリは現在ログイン中のアカウントのものではありません。",
  "组织账户的仓库不会被收录，也无法认领。":
    "組織アカウントのリポジトリは収集されず、登録もできません。",
  "这个仓库不是公开仓库。": "このリポジトリは公開されていません。",
  "这个仓库目前没有被收录。": "このリポジトリは現在収集されていません。",
  "你还没有认领这个仓库。": "このリポジトリはまだ登録していません。",
  "请求里要有 hidden 字段（true 或 false）。":
    "リクエストに hidden フィールド（true または false）が必要です。",
  "仓库名要写成 owner/name。": "リポジトリ名は owner/name の形式で書いてください。",

  "一、自己来": "一、自分の手で",
  "在你的任意一个**公开**仓库上加上 {topics} 主题（Settings → Topics），本站就会把它收录进来；核实之后，只有符合榜单条件的仓库才会出现在那个榜单上。主题是公开的、任何人都能看见，所以你随时可以把它拿掉。":
    "自分の**公開**リポジトリのいずれかに {topics} トピックを付せ（Settings → Topics）。本サイトがそれを収録する。核実ののち、ランキングの条件を満たしたものだけが、そのランキングに現れる。トピックは公開され、誰の目にも触れる。ゆえに、いつでも外せる。",
  "二、只是被看了一眼": "二、ただ一目、覗かれただけ",
  "查一个用户名是**预览**，不是发布：它不会收录任何仓库，也不会把结果发到任何地方。分享图只有你自己点开，发不发也由你决定。":
    "ユーザー名を調べるのは**プレビュー**であり、公表ではない。リポジトリを収録することも、結果をどこかへ送ることもない。共有画像は自ら開くもの。送るかどうかも、自らが決める。",
  "三、只读": "三、読み取り専用",
  "本站只读取公开仓库的元数据：最后一次推送时间、Star 数、Fork 数、语言。不读取仓库里的任何文件，不扫描密钥，不修改、归档、删除或同步任何仓库。":
    "本サイトが読むのは公開リポジトリのメタデータのみ：最後のプッシュ、Star 数、Fork 数、言語。リポジトリ内のファイルは読まず、鍵の走査もせず、変更・アーカイブ・削除・同期のいずれも行わない。",
  "四、随时可以拿走": "四、いつでも取り戻せる",
  "把主题拿掉，仓库就会从榜单上消失。如果你已经认领了它，也可以直接把它隐藏 —— 即使主题还在，它也不会再出现。":
    "トピックを外せば、リポジトリはランキングから消える。登録済みなら、直接隠すこともできる —— トピックが残っていても、二度と現れはしない。",
  "五、本站记什么": "五、本サイトが記すもの",
  "本站只做匿名计数：不保存 IP、浏览器标识、Cookie 或任何用户 ID，也不接第三方统计。计数只到「某一天、某类事件发生了几次」。你的用户名与仓库名不会进入统计。浏览器开启 Do Not Track 或 Global Privacy Control 时，本站不发送任何计数。":
    "本サイトが行うのは匿名の数え上げのみ。IP、ブラウザの識別子、Cookie、ユーザー ID は保存せず、第三者の解析も用いない。数え上げは「ある日に、ある出来事が幾度起きたか」まで。あなたのユーザー名とリポジトリ名は集計に入らない。ブラウザが Do Not Track または Global Privacy Control を送るなら、本サイトはいかなる数え上げも送らない。",
  "收录状态": "収録状態",
  "查一下收录状态": "収録状態を確認",
  "输入一个仓库（owner/name），看看它现在在不在龛里，以及为什么。":
    "リポジトリ（owner/name）を記せ。いま霊龕にあるか、そしてその理由が見える。",
  "仓库名": "リポジトリ名",
  "上一次查得有点密，等一会儿再试。":
    "少し間隔が短すぎました。しばらく待ってから再試行してください。",
  "命中的主题": "一致したトピック",
  "最近核实": "最終確認",
  "还没有核实记录": "確認記録はまだありません",
  "本次查询": "今回の照会",
  "查询时间": "照会時刻",
  "再查一次": "もう一度確認",
  "复制主题：": "トピックをコピー：",
  "{topic} · 已复制": "{topic} · コピーしました",

  "这个值": "この値",
  "{label}未知：{reason}": "{label}不明：{reason}",
  "这个字段": "この項目",
  "这个字段在当前语境下没有意义": "この項目はこの文脈では意味を持ちません",
  "不适用": "該当なし",
  "{label}在当前语境下没有意义": "{label} はこの文脈では意味を持ちません",
  "达成即颁发，可以下载，也可以分享":
    "達成と同時に授与。ダウンロードも共有も自在",

  "GitHub 暂时限制了这次读取的频率。稍后再试。":
    "GitHub が今回の読み取り頻度を制限しています。後でもう一度お試しください。",
  "读取 GitHub 超时了。稍后再试。":
    "GitHub の読み取りがタイムアウトしました。後でもう一度お試しください。",
  "暂时连不上 GitHub。": "GitHub に一時的に接続できません。",
  "没有找到这个 GitHub 账户。": "この GitHub アカウントは見つかりません。",
  "这是一个组织账户。本站只收录个人公开仓库。":
    "これは組織アカウントです。本サイトは個人の公開リポジトリのみを収集します。",
  "这个仓库读不到，可能已被删除或转为私有。":
    "このリポジトリを読み取れません。削除されたか、非公開になった可能性があります。",
  "这个仓库已经不在本站展示了。": "このリポジトリはもう本サイトに表示されていません。",
  "分享卡片暂时画不出来。": "共有カードを今は描画できません。",
  "登录没有完成。": "ログインが完了しませんでした。",
  "这次认领没有通过。": "今回の登録は受理されませんでした。",
  "这个接口还没有上线。": "このエンドポイントはまだ公開されていません。",
  "看起来你现在没有联网。连上网络后再试。":
    "オフラインのようです。接続を確認して再試行してください。",
  "用户名不太对。GitHub 用户名由字母、数字和单个连字符组成。":
    "ユーザー名が正しくありません。GitHub のユーザー名は英数字と単一のハイフンで構成されます。",
  "没有这个榜单。": "そのランキングはありません。",
  "请求的内容不对。": "リクエストの内容が正しくありません。",
  "请求的内容太大了。": "リクエストの内容が大きすぎます。",
  "站点还没有配置读取 GitHub 用的令牌，暂时读不到数据。":
    "サイトに GitHub 読み取り用トークンがまだ設定されておらず、データを取得できません。",
  "服务器返回了看不懂的内容。稍后再试。":
    "サーバーが解釈できない内容を返しました。後でもう一度お試しください。",
  "用户名不太对。": "ユーザー名が正しくありません。",
  "这个接口只支持 GET。": "このエンドポイントは GET のみ対応しています。",
  "这个接口只支持 POST。": "このエンドポイントは POST のみ対応しています。",
  "这个地址只支持 GET。": "このアドレスは GET のみ対応しています。",
  "没有这个分享图。": "その共有画像はありません。",
  "静态产物没有绑定。": "静的アセットがバインドされていません。",
  "这个请求不是本站发起的。": "このリクエストは本サイトから送信されたものではありません。",
  "不认识这个事件。": "不明なイベントです。",
  "事件的维度不对。": "イベントの次元が正しくありません。",
  "这个接口只支持 GET、POST 与 PATCH。":
    "このエンドポイントは GET・POST・PATCH のみに対応しています。",
  "@{login} 的{site}分享卡": "@{login} の{site}共有カード",

  "还没有公开仓库。": "公開リポジトリはまだありません。",
  "公开仓库少于 {n} 个。": "公開リポジトリが {n} 個未満です。",
  "有 {n} 个仓库最后一次推送在三年前或更早。":
    "三年前か、それより前に最後のプッシュを終えたリポジトリ：{n} 個。",
  "有 {n} 个仓库安静了一年以上，仍然有 Star。":
    "一年以上静まり、なお Star を宿すリポジトリ：{n} 個。",
  "{n} 个仓库是 Fork，占公开仓库的 {percent}。":
    "Fork は {n} 個、公開リポジトリの {percent}。",
  "{n} 个原创仓库，占公开仓库的 {percent}。":
    "オリジナルは {n} 個、公開リポジトリの {percent}。",
  "公开仓库 {n} 个，其中 Fork {m} 个。":
    "公開リポジトリ {n} 個、うち Fork {m} 個。",
};
