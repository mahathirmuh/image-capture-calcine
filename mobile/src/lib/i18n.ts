import { useSyncExternalStore } from "react";

// Two interface languages: English (default) and Simplified Chinese. Plant
// names and slot labels (Train 1, Bin 2) are identifiers that also appear on
// plant signage and in file names, so they are shown as the backend sends them.
export const LANGUAGES = ["en", "zh"] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = "en";

/** Shown in the switch itself, so each language is named in its own script. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  zh: "中文",
};

const en = {
  "common.unknownError": "Unable to complete the request.",
  "common.signOut": "Sign Out",
  "common.refreshing": "Refreshing...",
  "common.retry": "Retry",
  "common.ok": "OK",
  "common.unavailable": "Unavailable",
  "common.goBack": "Go back",
  "common.allPlants": "ALL",

  "language.label": "Language",
  "language.description": "Choose the language this app uses on this device.",

  "role.admin": "Super Admin",
  "role.operator": "Operator",
  "role.viewer": "Viewer",

  "boot.aria": "Restoring mobile session",
  "boot.kicker": "Mobile Session",
  "boot.title": "Restoring Access",
  "boot.copy": "Reconnecting your operator session and checking token validity.",

  "nav.aria": "Operator navigation",
  "nav.sessions": "Sessions",
  "nav.capture": "Capture",
  "nav.history": "History",
  "nav.device": "Device",
  "nav.settings": "Settings",

  "track.aria": "Session track",
  "track.regular": "3-Hour Sessions",
  "track.trial": "2-Hour Trial",

  "login.aria": "Operator sign in",
  "login.kicker": "Calcine Sampling Operator Tool",
  "login.subtitle": "Sign in to continue your assigned sampling session and capture workflow.",
  "login.zone": "Zone 04",
  "login.networkSecure": "Network Secure",
  "login.identifier": "Username or Email",
  "login.identifierPlaceholder": "Enter username or email",
  "login.password": "Password",
  "login.passwordPlaceholder": "Enter password",
  "login.hidePassword": "Hide password",
  "login.showPassword": "Show password",
  "login.required": "Username or password is required.",
  "login.helper": "Sign in with your operator account credentials.",
  "login.signingIn": "Signing In...",
  "login.signIn": "Sign In",
  "login.help": "Help / Support",
  "login.supportAria": "Support information",
  "login.shiftNote": "Shift note",
  "login.shiftNoteBody":
    "If access fails repeatedly, contact the shift supervisor or application admin to verify your operator account status.",

  "status.open": "Open",
  "status.completed": "Completed",
  "status.missing": "Missing",
  "status.upcoming": "Upcoming",

  "sessions.loadError": "Unable to load today sessions.",
  "sessions.operatorAccess": "Operator Access",
  "sessions.refreshAria": "Refresh today sessions",
  "sessions.title": "Today Sessions",
  "sessions.loadingDate": "Loading...",
  "sessions.plant": "Plant: {plant}",
  "sessions.assigned": "Assigned",
  "sessions.loadingTitle": "Loading sessions",
  "sessions.loadingBody": "Fetching today coverage from the backend.",
  "sessions.failedTitle": "Failed to load sessions",
  "sessions.summaryAria": "Session summary",
  "sessions.listAria": "Today session checklist",
  "sessions.emptyTitle": "No sessions available",
  "sessions.emptyBody": "No session coverage items were returned for the current operator scope.",
  "sessions.unknownPlant": "Unknown Plant",
  "sessions.plantsCount": "{count} Plants",

  "capture.status.completed": "Completed in coverage",
  "capture.status.missing": "Ready for recovery",
  "capture.status.open": "Session open",
  "capture.status.upcoming": "Ready for schedule",
  "capture.status.none": "Awaiting selection",
  "job.queued": "Queued",
  "job.running": "Running",
  "job.succeeded": "Succeeded",
  "job.failed": "Failed",
  "job.idle": "Idle",
  "capture.process.queued": "Capture request sent to the camera.",
  "capture.process.running": "Camera is capturing and saving the image.",
  "capture.process.succeeded": "Finalizing captured image...",
  "capture.process.failed": "Capture failed.",
  "capture.process.default": "Keep this screen open while capture is in progress.",
  "capture.actionError": "Unable to complete the camera action.",
  "capture.cancelled": "Camera operation cancelled.",
  "capture.pollTimeout": "Camera job did not finish before the mobile polling timeout.",
  "capture.invalidSchedule": "Invalid schedule response.",
  "capture.scheduleErrorTitle": "Unable to load capture schedule",
  "capture.scheduleLoadingTitle": "Loading capture schedule",
  "capture.scheduleLoadingBody": "Checking the plant schedule with the backend.",
  "capture.blockedAutomatic": "Session not available, please take sample at defined sessions.",
  "capture.blockedSelect": "Select a session from Today Sessions to define plant context first.",
  "capture.notAvailable": "Session not available",
  "capture.trialTag": "Trial",
  "capture.autoSession": "Auto session",
  "capture.headerDefault": "Capture Workflow",
  "capture.openSessionsAria": "Open today sessions",
  "capture.contextKicker": "Session Context",
  "capture.slotAria": "Capture target slot",
  "capture.cameraReady": "Camera ready • {device}",
  "capture.waitingPreview": "Session active • waiting for camera preview",
  "capture.capturingAria": "Capturing image",
  "capture.captureAria": "Capture image",
  "capture.stopping": "Stopping...",
  "capture.starting": "Starting...",
  "capture.stopSession": "Stop Session",
  "capture.startSession": "Start Session",
  "capture.feedAria": "Camera feed preview",
  "capture.liveView": "Live View",
  "capture.cameraPreview": "Camera preview",
  "capture.badge.refreshing": "Refreshing",
  "capture.badge.live": "Live",
  "capture.badge.standby": "Standby",
  "capture.previewAlt": "Live camera preview",
  "capture.processing": "Process capturing",
  "capture.processingWait": "Please wait while the capture is being processed.",
  "capture.preview.loading": "Loading live preview...",
  "capture.preview.active": "Live preview active",
  "capture.preview.waiting": "Waiting for first frame...",
  "capture.preview.start": "Start session to load live preview.",
  "capture.notice.capturingBody":
    "Please wait. The camera is taking the image and saving the result.",
  "capture.notice.completeTitle": "Capture complete",
  "capture.notice.completeBody": "Image saved successfully and ready in history.",
  "capture.notice.queuedTitle": "Capture queued",
  "capture.notice.queuedBody": "Image reached the app server queue ({pending} pending).",
  "capture.savedOnQueue": "Saved on app server queue ({pending} pending).",
  "capture.conflictTitle": "Camera already in use",
  "capture.conflictBody":
    "Camera is currently in use on another device. Wait until that session is released, then try again.",
  "capture.noAsset": "Capture succeeded but the edge did not return an asset id for saving.",
  "capture.invalidContext": "Select a scheduled session in a plant your account can access.",
  "capture.latestAria": "Open latest capture detail",
  "capture.latestSaved": "Latest Saved Result",
  "capture.latest": "Latest Result",
  "capture.idle": "IDLE",
  "capture.awaitingResult": "Awaiting capture result",
  "capture.awaitingResultBody": "After capture completes, the newest saved image will appear here.",
  "capture.failedTitle": "Camera action failed",
  "capture.jobAria": "Capture job progress",
  "capture.jobId": "JOB_ID: {id}",
  "capture.helper":
    "Wait for the camera preview, then use Capture to save the image for the selected slot.",

  "camera.plantForbidden": "Select a session in a plant your account can access.",
  "camera.assignmentChanged": "Camera assignment changed. Restart the camera session.",
  "camera.plantMismatch": "The camera response does not match the selected plant.",
  "camera.assignmentUnavailable": "Camera assignment is unavailable. Restart the camera session.",

  "history.loadError": "Unable to load recent captures.",
  "history.kicker": "Operator Archive",
  "history.title": "Recent Captures",
  "history.copy": "Review the latest capture results and open a record to inspect image metadata.",
  "history.refreshAria": "Refresh recent captures",
  "history.showing": "Showing latest {count} records",
  "history.total": "Total matches: {total}",
  "history.loadingTitle": "Loading recent captures",
  "history.loadingBody": "Fetching the latest records from the backend.",
  "history.failedTitle": "Failed to load capture history",
  "history.emptyTitle": "No captures found",
  "history.emptyBody": "No recent capture records were returned for the current operator scope.",
  "history.listAria": "Recent capture records",

  "record.status.downloaded": "Downloaded",
  "record.status.saved": "Saved",
  "record.status.pending": "Pending",
  "record.noSession": "No Session",
  "record.unassignedSlot": "Unassigned Slot",
  "record.unassignedPlant": "Unassigned Plant",
  "record.unassignedDevice": "Unassigned Device",
  "record.title": "Capture #{id}",

  "detail.loadError": "Unable to load capture detail.",
  "detail.title": "Capture Detail",
  "detail.loadingTitle": "Loading capture detail",
  "detail.loadingBody": "Fetching the selected capture record from the backend.",
  "detail.failedTitle": "Failed to load capture detail",
  "detail.unavailable": "The selected capture record is unavailable.",
  "detail.openWorkflowAria": "Open capture workflow",
  "detail.kicker": "Capture Record",
  "detail.imageAria": "Captured image preview",
  "detail.previewUnavailable": "Preview unavailable",
  "detail.metadata": "Metadata",
  "detail.capturedTime": "Captured Time",
  "detail.session": "Session",
  "detail.plant": "Plant",
  "detail.stationBin": "Station/Bin",
  "detail.status": "Status",
  "detail.fileName": "File Name",
  "detail.device": "Device",
  "detail.capturedBy": "Captured By",
  "detail.unknownOperator": "Unknown Operator",
  "detail.openCapture": "Open Capture",

  "device.loadError": "Unable to load device status.",
  "device.needPlant": "Your account needs an assigned plant. Contact your administrator.",
  "device.ambiguous":
    "More than one active camera is assigned to your plant. Contact your administrator.",
  "device.noCapture": "No capture yet",
  "device.health.online": "Online",
  "device.health.degraded": "Degraded",
  "device.health.offline": "Offline",
  "device.reach.noDevice": "No Device",
  "device.reach.excellent": "Excellent",
  "device.reach.limited": "Limited",
  "device.alert.noDevice": "No eligible device was resolved for this operator scope.",
  "device.alert.notReady": "Device is registered but the live edge state is not ready.",
  "device.alert.inactive": "Device is inactive in the registry.",
  "device.notReported": "Not Reported",
  "device.operatorDevice": "Operator Device",
  "device.assigned": "Assigned Device",
  "device.refreshAria": "Refresh device status",
  "device.selectAria": "Select device plant",
  "device.selectTitle": "Select a session first",
  "device.selectBody":
    "Your account can access all plants. Choose a session in Today Sessions to view its assigned camera.",
  "device.openSessions": "Open Today Sessions",
  "device.loadingAria": "Device loading state",
  "device.loadingTitle": "Loading device status",
  "device.loadingBody": "Resolving the primary device and fetching live edge status.",
  "device.errorAria": "Device error state",
  "device.systemAlert": "System Alert",
  "device.alertAria": "System alert",
  "device.telemetry": "Core Telemetry",
  "device.id": "ID: {code}",
  "device.healthState": "Health State",
  "device.reachability": "Reachability",
  "device.lastCapture": "Last Capture",
  "device.uplink": "Uplink",
  "device.diagnostics": "Diagnostics",
  "device.readOnly": "Read-only operator view",
  "device.waiting": "Waiting",
  "device.diagnosticsBody":
    "Mobile operators can review health state, uplink, and last capture from this screen. Remote diagnostics and repair actions stay on the admin workflow in this phase.",
  "device.refreshStatus": "Refresh Status",
  "device.authLevel": "Auth Level: {role}",

  "settings.title": "Settings",
  "settings.logoutAria": "Logout",
  "settings.operator": "Operator",
  "settings.identity": "Identity",
  "settings.assignment": "Assignment",
  "settings.account": "Account",
  "settings.noEmail": "No email registered",
  "settings.saveError": "Unable to save the updated mobile preference.",
  "settings.saveFailedTitle": "Preference update failed",
  "settings.preferences": "Operator Preferences",
  "pref.lightMode": "Light Mode",
  "pref.lightModeDescription":
    "Switch the operator interface to a brighter theme and save it on this device.",
  "pref.highContrast": "High-Contrast Mode",
  "pref.highContrastDescription":
    "Boost interface contrast for better visibility on the plant floor.",
  "pref.warmup": "History Warm-Up",
  "pref.warmupDescription":
    "Preload recent thumbnails in the background after login or session restore.",
  "settings.runtime": "Runtime Snapshot",
  "settings.appVersion": "App Version",
  "settings.apiPath": "API Path",
  "settings.accessExpires": "Access Expires",
  "settings.refreshExpires": "Refresh Expires",
  "settings.customUrl": "Custom URL",

  // Backend error codes. The server writes its messages in Indonesian, so a
  // known code is shown in the interface language and the server text is only
  // a fallback for codes this table does not know.
  "error.network": "Cannot reach the server. Check the network connection.",
  "error.REQUEST_FAILED": "Request failed with status {status}.",
  "error.MOBILE_API_URL_MISSING":
    "This app build has no server address. Contact your administrator.",
  "error.MOBILE_API_KEY_MISSING": "This app build has no API key. Contact your administrator.",
  "error.INVALID_CREDENTIALS": "Incorrect username or password.",
  "error.ACCOUNT_DISABLED": "This account is disabled. Contact your administrator.",
  "error.INVALID_API_KEY":
    "This app build is not authorized on the server. Contact your administrator.",
  "error.API_DISABLED": "The server API is turned off. Contact your administrator.",
  "error.UNAUTHENTICATED": "Your sign-in has expired. Sign in again.",
  "error.REFRESH_EXPIRED": "Your sign-in has expired. Sign in again.",
  "error.REFRESH_INVALID": "Your sign-in has expired. Sign in again.",
  "error.REFRESH_REVOKED": "Your sign-in has expired. Sign in again.",
  "error.USER_TOKEN_REQUIRED": "Sign in again to use this function.",
  "error.FORBIDDEN": "Your account is not allowed to access this data.",
  "error.NOT_FOUND": "The requested record was not found.",
  "error.INTERNAL_ERROR": "The server could not process the request. Try again.",
  "error.CARDDB_NOT_CONFIGURED":
    "The server database is not configured. Contact your administrator.",
  "error.SESSION_CONFLICT":
    "Camera is currently in use on another device. Wait until that session is released, then try again.",
  "error.INVALID_SESSION": "The camera session is no longer valid. Start the session again.",
  "error.SESSION_LOST": "The camera session was lost. Start the session again.",
  "error.EDGE_UNREACHABLE":
    "The camera service cannot be reached. Check the camera Mini PC and the network.",
  "error.EDGE_REQUEST_FAILED":
    "The camera service rejected the request. Check that the camera is on and connected.",
  "error.PREVIEW_UNAVAILABLE": "Camera preview is not available right now.",
  "error.DEVICE_NOT_FOUND": "The camera is not registered. Contact your administrator.",
  "error.DEVICE_FORBIDDEN": "Your account is not allowed to use this camera.",
  "error.DEVICE_INACTIVE": "This camera is marked inactive. Contact your administrator.",
  "error.DEVICE_AMBIGUOUS":
    "More than one active camera is assigned to this plant. Contact your administrator.",
  "error.NO_DEVICE": "No active camera is assigned to this plant. Contact your administrator.",
  "error.DEVICE_PLANT_MISMATCH":
    "The camera is no longer assigned to this plant. Select the session again.",
  "error.DEVICE_URL_REQUIRED":
    "The camera address has not been configured. Contact your administrator.",
  "error.DEVICE_ASSIGNMENT_REQUIRED":
    "Camera assignment is not configured on the server. Contact your administrator.",
  "error.PLANT_DEVICE_MISMATCH": "The camera does not belong to the plant of this capture.",
  "error.CAPTURE_SCHEDULE_REJECTED": "This session is not open for capture.",
  "error.SESSION_CLOSED": "The capture window for this session has ended.",
  "error.SESSION_UPCOMING": "This session has not started yet.",
  "error.SCHEDULE_INVALID_SESSION": "This session is not part of the plant schedule.",
  "error.INVALID_CAPTURE_RECEIPT": "The capture confirmation expired. Take the photo again.",
  "error.CAPTURE_CONTEXT_MISMATCH":
    "The capture details do not match the camera command. Take the photo again.",
  "error.CAPTURE_ASSET_MISMATCH":
    "The photo could not be verified against the camera job. Take the photo again.",
  "error.CAPTURE_JOB_UNAVAILABLE": "The camera job could not be verified. Try again.",
  "error.NETWORK_SAVE_NOT_CONFIGURED":
    "Photo storage is not configured on the server. Contact your administrator.",
  "error.SPOOL_FULL":
    "The server queue is full. Contact your administrator before capturing again.",
  "error.MEDIA_FETCH_FAILED": "The photo could not be fetched from the camera service.",
  "error.FILE_NOT_READY": "The photo has not reached the network folder yet.",
  "error.THUMB_NOT_FOUND": "No thumbnail is available for this capture.",
} as const;

export type TranslationKey = keyof typeof en;

const zh: Record<TranslationKey, string> = {
  "common.unknownError": "无法完成请求。",
  "common.signOut": "退出登录",
  "common.refreshing": "正在刷新…",
  "common.retry": "重试",
  "common.ok": "确定",
  "common.unavailable": "不可用",
  "common.goBack": "返回",
  "common.allPlants": "全部工厂",

  "language.label": "语言",
  "language.description": "选择本设备上应用使用的语言。",

  "role.admin": "超级管理员",
  "role.operator": "操作员",
  "role.viewer": "查看者",

  "boot.aria": "正在恢复移动端会话",
  "boot.kicker": "移动端会话",
  "boot.title": "正在恢复访问",
  "boot.copy": "正在重新连接操作员会话并检查登录有效性。",

  "nav.aria": "操作员导航",
  "nav.sessions": "场次",
  "nav.capture": "拍摄",
  "nav.history": "历史",
  "nav.device": "设备",
  "nav.settings": "设置",

  "track.aria": "场次类型",
  "track.regular": "3小时场次",
  "track.trial": "2小时试验",

  "login.aria": "操作员登录",
  "login.kicker": "焙砂取样操作员工具",
  "login.subtitle": "登录后继续您负责的取样场次和拍摄流程。",
  "login.zone": "04 区",
  "login.networkSecure": "网络安全",
  "login.identifier": "用户名或邮箱",
  "login.identifierPlaceholder": "请输入用户名或邮箱",
  "login.password": "密码",
  "login.passwordPlaceholder": "请输入密码",
  "login.hidePassword": "隐藏密码",
  "login.showPassword": "显示密码",
  "login.required": "请输入用户名和密码。",
  "login.helper": "请使用操作员账号登录。",
  "login.signingIn": "正在登录…",
  "login.signIn": "登录",
  "login.help": "帮助 / 支持",
  "login.supportAria": "支持信息",
  "login.shiftNote": "当班提示",
  "login.shiftNoteBody": "如果多次登录失败，请联系当班主管或系统管理员核实您的操作员账号状态。",

  "status.open": "进行中",
  "status.completed": "已完成",
  "status.missing": "缺失",
  "status.upcoming": "未开始",

  "sessions.loadError": "无法加载今日场次。",
  "sessions.operatorAccess": "操作员权限",
  "sessions.refreshAria": "刷新今日场次",
  "sessions.title": "今日场次",
  "sessions.loadingDate": "加载中…",
  "sessions.plant": "工厂：{plant}",
  "sessions.assigned": "已分配",
  "sessions.loadingTitle": "正在加载场次",
  "sessions.loadingBody": "正在从服务器获取今日场次情况。",
  "sessions.failedTitle": "场次加载失败",
  "sessions.summaryAria": "场次汇总",
  "sessions.listAria": "今日场次清单",
  "sessions.emptyTitle": "暂无场次",
  "sessions.emptyBody": "当前操作员范围内没有场次记录。",
  "sessions.unknownPlant": "未知工厂",
  "sessions.plantsCount": "{count} 个工厂",

  "capture.status.completed": "该场次已完成",
  "capture.status.missing": "可补拍",
  "capture.status.open": "场次进行中",
  "capture.status.upcoming": "等待场次开始",
  "capture.status.none": "等待选择",
  "job.queued": "排队中",
  "job.running": "执行中",
  "job.succeeded": "成功",
  "job.failed": "失败",
  "job.idle": "空闲",
  "capture.process.queued": "拍摄指令已发送到相机。",
  "capture.process.running": "相机正在拍摄并保存图像。",
  "capture.process.succeeded": "正在完成图像保存…",
  "capture.process.failed": "拍摄失败。",
  "capture.process.default": "拍摄过程中请保持此页面打开。",
  "capture.actionError": "无法完成相机操作。",
  "capture.cancelled": "相机操作已取消。",
  "capture.pollTimeout": "相机任务未在等待时间内完成。",
  "capture.invalidSchedule": "排程数据无效。",
  "capture.scheduleErrorTitle": "无法加载拍摄排程",
  "capture.scheduleLoadingTitle": "正在加载拍摄排程",
  "capture.scheduleLoadingBody": "正在向服务器核对工厂排程。",
  "capture.blockedAutomatic": "当前无可用场次，请在规定场次取样。",
  "capture.blockedSelect": "请先在“今日场次”中选择一个场次以确定工厂。",
  "capture.notAvailable": "当前无可用场次",
  "capture.trialTag": "试验",
  "capture.autoSession": "自动场次",
  "capture.headerDefault": "拍摄流程",
  "capture.openSessionsAria": "打开今日场次",
  "capture.contextKicker": "场次信息",
  "capture.slotAria": "拍摄目标位置",
  "capture.cameraReady": "相机就绪 • {device}",
  "capture.waitingPreview": "会话已启动 • 等待相机预览",
  "capture.capturingAria": "正在拍摄",
  "capture.captureAria": "拍摄图像",
  "capture.stopping": "正在停止…",
  "capture.starting": "正在启动…",
  "capture.stopSession": "停止会话",
  "capture.startSession": "启动会话",
  "capture.feedAria": "相机预览画面",
  "capture.liveView": "实时画面",
  "capture.cameraPreview": "相机预览",
  "capture.badge.refreshing": "刷新中",
  "capture.badge.live": "实时",
  "capture.badge.standby": "待机",
  "capture.previewAlt": "相机实时预览",
  "capture.processing": "正在拍摄",
  "capture.processingWait": "正在处理拍摄，请稍候。",
  "capture.preview.loading": "正在加载实时预览…",
  "capture.preview.active": "实时预览已开启",
  "capture.preview.waiting": "正在等待第一帧画面…",
  "capture.preview.start": "启动会话后即可加载实时预览。",
  "capture.notice.capturingBody": "请稍候，相机正在拍摄并保存结果。",
  "capture.notice.completeTitle": "拍摄完成",
  "capture.notice.completeBody": "图像已保存，可在历史记录中查看。",
  "capture.notice.queuedTitle": "拍摄已排队",
  "capture.notice.queuedBody": "图像已进入服务器队列（{pending} 张待传）。",
  "capture.savedOnQueue": "已保存到服务器队列（{pending} 张待传）。",
  "capture.conflictTitle": "相机正在被使用",
  "capture.conflictBody": "相机正在被另一台设备使用。请等待该会话释放后再试。",
  "capture.noAsset": "拍摄成功，但相机服务未返回可保存的图像编号。",
  "capture.invalidContext": "请选择您账号有权限的工厂内的排程场次。",
  "capture.latestAria": "打开最新拍摄详情",
  "capture.latestSaved": "最新保存结果",
  "capture.latest": "最新结果",
  "capture.idle": "空闲",
  "capture.awaitingResult": "等待拍摄结果",
  "capture.awaitingResultBody": "拍摄完成后，最新保存的图像将显示在这里。",
  "capture.failedTitle": "相机操作失败",
  "capture.jobAria": "拍摄任务进度",
  "capture.jobId": "任务编号：{id}",
  "capture.helper": "等待相机预览出现后，点击拍摄按钮保存所选位置的图像。",

  "camera.plantForbidden": "请选择您账号有权限的工厂内的场次。",
  "camera.assignmentChanged": "相机分配已变更，请重新启动相机会话。",
  "camera.plantMismatch": "相机返回的信息与所选工厂不符。",
  "camera.assignmentUnavailable": "无法获取相机分配，请重新启动相机会话。",

  "history.loadError": "无法加载最近的拍摄记录。",
  "history.kicker": "操作员档案",
  "history.title": "最近拍摄",
  "history.copy": "查看最新的拍摄结果，点击记录可查看图像详细信息。",
  "history.refreshAria": "刷新最近拍摄",
  "history.showing": "显示最新 {count} 条记录",
  "history.total": "共 {total} 条",
  "history.loadingTitle": "正在加载最近拍摄",
  "history.loadingBody": "正在从服务器获取最新记录。",
  "history.failedTitle": "拍摄历史加载失败",
  "history.emptyTitle": "未找到拍摄记录",
  "history.emptyBody": "当前操作员范围内没有最近的拍摄记录。",
  "history.listAria": "最近拍摄记录",

  "record.status.downloaded": "已下载",
  "record.status.saved": "已保存",
  "record.status.pending": "待上传",
  "record.noSession": "无场次",
  "record.unassignedSlot": "未分配位置",
  "record.unassignedPlant": "未分配工厂",
  "record.unassignedDevice": "未分配设备",
  "record.title": "拍摄 #{id}",

  "detail.loadError": "无法加载拍摄详情。",
  "detail.title": "拍摄详情",
  "detail.loadingTitle": "正在加载拍摄详情",
  "detail.loadingBody": "正在从服务器获取所选拍摄记录。",
  "detail.failedTitle": "拍摄详情加载失败",
  "detail.unavailable": "所选拍摄记录不可用。",
  "detail.openWorkflowAria": "打开拍摄流程",
  "detail.kicker": "拍摄记录",
  "detail.imageAria": "拍摄图像预览",
  "detail.previewUnavailable": "无法预览",
  "detail.metadata": "详细信息",
  "detail.capturedTime": "拍摄时间",
  "detail.session": "场次",
  "detail.plant": "工厂",
  "detail.stationBin": "工位/料仓",
  "detail.status": "状态",
  "detail.fileName": "文件名",
  "detail.device": "设备",
  "detail.capturedBy": "拍摄人",
  "detail.unknownOperator": "未知操作员",
  "detail.openCapture": "打开拍摄",

  "device.loadError": "无法加载设备状态。",
  "device.needPlant": "您的账号尚未分配工厂，请联系管理员。",
  "device.ambiguous": "您的工厂分配了多台启用的相机，请联系管理员。",
  "device.noCapture": "尚无拍摄",
  "device.health.online": "在线",
  "device.health.degraded": "异常",
  "device.health.offline": "离线",
  "device.reach.noDevice": "无设备",
  "device.reach.excellent": "良好",
  "device.reach.limited": "受限",
  "device.alert.noDevice": "当前操作员范围内没有可用设备。",
  "device.alert.notReady": "设备已登记，但相机服务当前未就绪。",
  "device.alert.inactive": "设备在登记表中已停用。",
  "device.notReported": "未上报",
  "device.operatorDevice": "操作员设备",
  "device.assigned": "已分配设备",
  "device.refreshAria": "刷新设备状态",
  "device.selectAria": "选择设备所属工厂",
  "device.selectTitle": "请先选择场次",
  "device.selectBody": "您的账号可访问所有工厂。请在“今日场次”中选择一个场次以查看对应的相机。",
  "device.openSessions": "打开今日场次",
  "device.loadingAria": "设备加载状态",
  "device.loadingTitle": "正在加载设备状态",
  "device.loadingBody": "正在确认主设备并获取实时状态。",
  "device.errorAria": "设备错误状态",
  "device.systemAlert": "系统警告",
  "device.alertAria": "系统警告",
  "device.telemetry": "核心状态",
  "device.id": "编号：{code}",
  "device.healthState": "健康状态",
  "device.reachability": "连通性",
  "device.lastCapture": "最近拍摄",
  "device.uplink": "上行链路",
  "device.diagnostics": "诊断",
  "device.readOnly": "操作员只读视图",
  "device.waiting": "等待中",
  "device.diagnosticsBody":
    "操作员可在此页面查看健康状态、上行链路和最近拍摄。远程诊断和维修操作目前仍由管理员处理。",
  "device.refreshStatus": "刷新状态",
  "device.authLevel": "权限级别：{role}",

  "settings.title": "设置",
  "settings.logoutAria": "退出登录",
  "settings.operator": "操作员",
  "settings.identity": "账号",
  "settings.assignment": "所属工厂",
  "settings.account": "邮箱",
  "settings.noEmail": "未登记邮箱",
  "settings.saveError": "无法保存偏好设置。",
  "settings.saveFailedTitle": "偏好设置更新失败",
  "settings.preferences": "操作员偏好",
  "pref.lightMode": "浅色模式",
  "pref.lightModeDescription": "将界面切换为明亮主题，并保存在本设备上。",
  "pref.highContrast": "高对比度模式",
  "pref.highContrastDescription": "提高界面对比度，便于在生产现场查看。",
  "pref.warmup": "历史预加载",
  "pref.warmupDescription": "登录或恢复会话后在后台预加载最近的缩略图。",
  "settings.runtime": "运行信息",
  "settings.appVersion": "应用版本",
  "settings.apiPath": "API 路径",
  "settings.accessExpires": "访问令牌到期",
  "settings.refreshExpires": "刷新令牌到期",
  "settings.customUrl": "自定义地址",

  "error.network": "无法连接服务器，请检查网络连接。",
  "error.REQUEST_FAILED": "请求失败，状态码 {status}。",
  "error.MOBILE_API_URL_MISSING": "此应用版本未配置服务器地址，请联系管理员。",
  "error.MOBILE_API_KEY_MISSING": "此应用版本未配置接口密钥，请联系管理员。",
  "error.INVALID_CREDENTIALS": "用户名或密码错误。",
  "error.ACCOUNT_DISABLED": "该账号已停用，请联系管理员。",
  "error.INVALID_API_KEY": "此应用版本未获服务器授权，请联系管理员。",
  "error.API_DISABLED": "服务器接口未启用，请联系管理员。",
  "error.UNAUTHENTICATED": "登录已过期，请重新登录。",
  "error.REFRESH_EXPIRED": "登录已过期，请重新登录。",
  "error.REFRESH_INVALID": "登录已过期，请重新登录。",
  "error.REFRESH_REVOKED": "登录已过期，请重新登录。",
  "error.USER_TOKEN_REQUIRED": "请重新登录后再使用此功能。",
  "error.FORBIDDEN": "您的账号无权访问此数据。",
  "error.NOT_FOUND": "未找到所请求的记录。",
  "error.INTERNAL_ERROR": "服务器无法处理请求，请重试。",
  "error.CARDDB_NOT_CONFIGURED": "服务器数据库未配置，请联系管理员。",
  "error.SESSION_CONFLICT": "相机正在被另一台设备使用。请等待该会话释放后再试。",
  "error.INVALID_SESSION": "相机会话已失效，请重新启动会话。",
  "error.SESSION_LOST": "相机会话已丢失，请重新启动会话。",
  "error.EDGE_UNREACHABLE": "无法连接相机服务，请检查相机迷你电脑和网络。",
  "error.EDGE_REQUEST_FAILED": "相机服务拒绝了请求，请检查相机是否已开机并连接。",
  "error.PREVIEW_UNAVAILABLE": "暂时无法获取相机预览。",
  "error.DEVICE_NOT_FOUND": "相机未登记，请联系管理员。",
  "error.DEVICE_FORBIDDEN": "您的账号无权使用此相机。",
  "error.DEVICE_INACTIVE": "此相机已被停用，请联系管理员。",
  "error.DEVICE_AMBIGUOUS": "该工厂分配了多台启用的相机，请联系管理员。",
  "error.NO_DEVICE": "该工厂未分配启用的相机，请联系管理员。",
  "error.DEVICE_PLANT_MISMATCH": "相机已不再分配给该工厂，请重新选择场次。",
  "error.DEVICE_URL_REQUIRED": "相机地址尚未配置，请联系管理员。",
  "error.DEVICE_ASSIGNMENT_REQUIRED": "服务器尚未配置相机分配，请联系管理员。",
  "error.PLANT_DEVICE_MISMATCH": "相机不属于本次拍摄的工厂。",
  "error.CAPTURE_SCHEDULE_REJECTED": "该场次当前不可拍摄。",
  "error.SESSION_CLOSED": "该场次的拍摄时间已结束。",
  "error.SESSION_UPCOMING": "该场次尚未开始。",
  "error.SCHEDULE_INVALID_SESSION": "该场次不在工厂排程内。",
  "error.INVALID_CAPTURE_RECEIPT": "拍摄凭证已失效，请重新拍摄。",
  "error.CAPTURE_CONTEXT_MISMATCH": "拍摄信息与相机指令不一致，请重新拍摄。",
  "error.CAPTURE_ASSET_MISMATCH": "无法核实照片与相机任务是否一致，请重新拍摄。",
  "error.CAPTURE_JOB_UNAVAILABLE": "无法核实相机任务，请重试。",
  "error.NETWORK_SAVE_NOT_CONFIGURED": "服务器未配置照片存储，请联系管理员。",
  "error.SPOOL_FULL": "服务器队列已满，请联系管理员后再拍摄。",
  "error.MEDIA_FETCH_FAILED": "无法从相机服务获取照片。",
  "error.FILE_NOT_READY": "照片尚未传到网络文件夹。",
  "error.THUMB_NOT_FOUND": "此拍摄没有缩略图。",
};

export const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = { en, zh };

type Params = Record<string, string | number>;

function render(language: Language, key: TranslationKey, params?: Params): string {
  const template = DICTIONARIES[language][key] ?? en[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export type Translator = (key: TranslationKey, params?: Params) => string;

// One translator per language, so its identity changes exactly when the
// language does and it can be listed in hook dependency arrays.
const TRANSLATORS: Record<Language, Translator> = {
  en: (key, params) => render("en", key, params),
  zh: (key, params) => render("zh", key, params),
};

let currentLanguage: Language = DEFAULT_LANGUAGE;
const listeners = new Set<() => void>();

/**
 * The language to switch to when an account signs in, or null to leave the
 * device as it is.
 *
 * The account's default is chosen on the web Users page from Indonesian,
 * English and Chinese. This app has no Indonesian, so "id" -- like a missing
 * value from an older backend -- changes nothing here.
 */
export function accountLanguage(value: unknown): Language | null {
  return isLanguage(value) ? value : null;
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

export function getLanguage(): Language {
  return currentLanguage;
}

export function setLanguage(next: Language): void {
  if (next === currentLanguage) return;
  currentLanguage = next;
  if (typeof document !== "undefined") {
    document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** For code outside React (API helpers, mappers). Reads the language at call time. */
export function translate(key: TranslationKey, params?: Params): string {
  return render(currentLanguage, key, params);
}

export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage);
}

/** Translator for components; re-renders them when the language is switched. */
export function useT(): Translator {
  return TRANSLATORS[useLanguage()];
}

/** Locale for dates, so "Oct 05, 2026" becomes "2026年10月05日" in Chinese. */
export function dateLocale(): string {
  return currentLanguage === "zh" ? "zh-CN" : "en-US";
}

/** Locale for 24-hour clock times. */
export function timeLocale(): string {
  return currentLanguage === "zh" ? "zh-CN" : "en-GB";
}

function hasKey(key: string): key is TranslationKey {
  return key in en;
}

export function roleLabel(role: string | null | undefined): string {
  const key = `role.${role ?? ""}`;
  return hasKey(key) ? translate(key) : (role ?? "");
}

export function plantLabel(plant: string | null | undefined): string {
  return !plant || plant === "ALL" ? translate("common.allPlants") : plant;
}

/**
 * Message for a failed request, in the interface language.
 *
 * A known backend code wins over the server's own text; anything else falls
 * back to the error's message and finally to the screen's generic wording.
 */
export function describeError(error: unknown, fallback: TranslationKey): string {
  const record = error && typeof error === "object" ? (error as Record<string, unknown>) : null;
  const code = typeof record?.code === "string" ? record.code : null;
  const message = typeof record?.message === "string" ? record.message : "";

  if (code === "CAPTURE_SCHEDULE_REJECTED") {
    const reason = /^([A-Z_]+):/.exec(message)?.[1];
    const reasonKey = `error.${reason === "INVALID_SESSION" ? "SCHEDULE_INVALID_SESSION" : reason}`;
    if (reason && hasKey(reasonKey)) return translate(reasonKey);
  }
  if (code) {
    const key = `error.${code}`;
    if (hasKey(key)) {
      return translate(key, { status: typeof record?.status === "number" ? record.status : "" });
    }
  }
  if (error instanceof TypeError && /fetch|network|load failed/i.test(error.message)) {
    return translate("error.network");
  }
  return message || translate(fallback);
}
