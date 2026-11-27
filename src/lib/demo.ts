export const navigation = [
  ["/", "总览"], ["/jobs", "任务配置"], ["/runs", "运行历史"], ["/movies", "电影库"],
  ["/credentials", "TMDB 凭据池"], ["/consumers", "外部应用"], ["/audit", "操作审计"], ["/docs/api", "API 文档"],
] as const;

export const movies = ([
  {id:"920101",title:"海街晨光",en:"A Shore in the Morning",genre:"剧情",year:2024,status:"新鲜",art:"shore",language:"ja",runtime:106,overview:"海港拆迁前，一名放映员带着褪色的胶片回到故乡，挨家挨户寻找当年镜头里的渔民。"},
  {id:"438631",title:"星际回响",en:"Echoes of the Horizon",genre:"科幻 / 剧情",year:2023,status:"新鲜",art:"planet",language:"en",runtime:142,overview:"深空观测站收到一段来自环形行星背面的信号。值守的工程师辨认出失联探测器的呼号，却发现讯号正在复述她尚未发出的指令。"},
  {id:"118420",title:"夜雨迷踪",en:"A City in Rain",genre:"悬疑",year:2021,status:"新鲜",art:"rain",language:"en",runtime:98,overview:"暴雨淹没了最后一班电车的轨道。一名失物招领员沿着雨水冲出的旧票根，追查二十年前消失的乘客。"},
  {id:"843527",title:"深海回声",en:"Echoes at Depth",genre:"科幻",year:2025,status:"新鲜",art:"ocean",language:"en",runtime:112,overview:"海沟测绘队截获一段与洋流反向传播的录音。随着潜艇下沉，他们发现声源与数年前失踪的一座观测站有关。"},
  {id:"823338",title:"沙海行者",en:"The Dune Walker",genre:"冒险",year:2024,status:"已过期",art:"dune",language:"fr",runtime:104,overview:"一次沙暴抹去了商路。老驼队向导不得不相信新来的测绘员，依靠星图和废弃水井横穿荒地。"},
  {id:"603892",title:"雪岭暗影",en:"Shadow on the Ridge",genre:"剧情",year:2022,status:"新鲜",art:"snow",language:"en",runtime:109,overview:"一名护林员在雪线发现了不该有人经过的足迹，只能赶在封山之前，沿着险峻的北坡寻找失踪者。"},
  {id:"920137",title:"秋日长信",en:"Letters in October",genre:"剧情",year:2024,status:"新鲜",art:"field",language:"zh",runtime:101,overview:"邮车停运之后，一位乡间邮差骑车送出积压数十年的信，其中一封写给她早已搬走的姐姐。"},
  {id:"920155",title:"午夜放映厅",en:"After the Matinee",genre:"悬疑",year:2023,status:"新鲜",art:"cinema",language:"ko",runtime:116,overview:"最后一场电影开映后，影院员工发现片尾字幕里列出了今晚的观众名单，最后一个名字从未售票。"},
  {id:"920168",title:"黎明之城",en:"The City at Daybreak",genre:"剧情",year:2022,status:"已过期",art:"city",language:"en",runtime:123,overview:"在停电的城市里，急救调度员和出租车司机接力护送一名病人，穿过从深夜逐渐苏醒的街区。"},
  {id:"920179",title:"风从山口来",en:"Wind Through the Pass",genre:"冒险",year:2025,status:"新鲜",art:"valley",language:"zh",runtime:108,overview:"草原上的测风塔轮番沉默。两兄妹带着手绘路线图进入山口，寻找仍在广播的最后一台仪器。"},
] satisfies Omit<Movie,"locale">[]).map((movie):Movie=>({...movie,locale:"zh-CN"}));
export type Movie = {id:string;title:string;en:string;genre:string;year:number;locale:"zh-CN";status:"新鲜"|"已过期";art:"shore"|"planet"|"rain"|"ocean"|"dune"|"snow"|"field"|"cinema"|"city"|"valley";language:string;runtime:number;overview:string};

export const phases = [
  { label: "已发现", count: 1280 }, { label: "已入队", count: 1280 },
  { label: "已抓取", count: 1246 }, { label: "已入库", count: 1240 },
] as const;
export const completion = (phases[3].count / phases[0].count * 100).toFixed(1);
export const number = (value:number) => new Intl.NumberFormat("en-US").format(value);
