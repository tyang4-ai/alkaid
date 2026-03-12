/**
 * Pre-written template responses for offline AI commentary.
 * Bilingual (Chinese + English) in the voice of Sun Tzu / ancient Chinese generals.
 * Used as fallback when the LLM API is unavailable.
 */

export interface CommentaryContext {
  orderType: string;   // 'MOVE' | 'ATTACK' | 'HOLD' | 'RETREAT' | 'FLANK' | 'CHARGE' | 'FORM_UP' | 'DISENGAGE' | 'RALLY'
  weather?: string;
  timeOfDay?: string;
  morale?: 'high' | 'medium' | 'low';
  casualties?: 'light' | 'moderate' | 'heavy';
}

interface Template {
  text: string;
  conditions?: Partial<Pick<CommentaryContext, 'weather' | 'morale' | 'casualties' | 'timeOfDay'>>;
}

const ORDER_TEMPLATES: Record<string, Template[]> = {
  ATTACK: [
    { text: '全军进攻！ — Press the attack while their formation wavers. 乱中取胜 — seize victory from disorder.' },
    { text: '攻其不备 — Strike where they are unprepared. At Guandu, Cao Cao burned Yuan Shao\'s supply depot with a force one-tenth his size.' },
    { text: '兵贵神速 — Speed is the essence of war. Commit now before they reinforce.' },
    { text: '以正合，以奇胜 — Engage with the orthodox, achieve victory with the unorthodox. Press forward.' },
    { text: '围魏救赵 — By threatening what they value, we force their hand. Attack.' },
    { text: '攻敌必救 — Attack what the enemy must defend. Their reserves will be drawn out.', conditions: { morale: 'high' } },
    { text: '穷寇勿迫 — Do not press a cornered enemy too hard; desperate men fight like demons.', conditions: { casualties: 'heavy' } },
  ],

  FLANK: [
    { text: '包抄侧翼 — The pincer closes. This is how Han Xin destroyed Xiang Yu\'s army at Gaixia.' },
    { text: '声东击西 — Feint east, strike west. Their exposed flank is the true objective.' },
    { text: '兵无常势 — Water has no constant form; war has no constant posture. Flow around them.' },
    { text: '出其不意 — Appear where they do not expect. The flank is where battles are decided.' },
    { text: '迂回包抄 — The indirect approach. Sun Bin used this at Maling to annihilate Pang Juan.' },
  ],

  RETREAT: [
    { text: '三十六计，走为上计 — Of the Thirty-Six Stratagems, retreat is the best. Preserve strength for the decisive moment.' },
    { text: '撤退不是耻辱 — A strategic withdrawal is not defeat. Liu Bei retreated seven times before founding Shu Han.' },
    { text: '能战则战，不能战则守，不能守则走 — If you cannot fight, defend. If you cannot defend, withdraw.' },
    { text: '留得青山在，不怕没柴烧 — While green hills remain, there will be wood to burn. Fall back.' },
    { text: '知难而退 — Knowing when to retreat is wisdom, not weakness.', conditions: { casualties: 'heavy' } },
    { text: '退一步海阔天空 — Step back and the sky opens. Regroup and counter.', conditions: { morale: 'low' } },
  ],

  CHARGE: [
    { text: '全军冲锋！破釜沉舟 — Charge! Like Xiang Yu at Julu — smash the cauldrons, sink the boats. No retreat.' },
    { text: '一鼓作气 — Strike with the first beat of the drum, when morale is highest.' },
    { text: '势如破竹 — Like splitting bamboo, the first stroke decides everything. Charge!' },
    { text: '破阵冲锋 — The cavalry wedge shatters their line. At Changping, Bai Qi used exactly this.' },
    { text: '勇者胜 — When two armies meet, the braver prevails. Charge now!', conditions: { morale: 'high' } },
  ],

  HOLD: [
    { text: '不动如山 — Immovable as a mountain. Let them spend their strength against our formation.' },
    { text: '坚守阵地 — Hold the ground. Sima Yi held Wuzhang Plains for months against Zhuge Liang.' },
    { text: '以逸待劳 — Rest and await the weary. They will exhaust themselves upon our shields.' },
    { text: '固若金汤 — Solid as a bronze wall. The fortress that does not move cannot be outmaneuvered.' },
    { text: '守株待兔 — Stand firm like a patient hunter. The opportunity will present itself.' },
    { text: '风雨之中更需坚守 — In storm and rain, hold all the more firmly.', conditions: { weather: 'rain' } },
  ],

  FORM_UP: [
    { text: '列阵！兵者诡道也 — Form ranks! War is deception, but discipline is its foundation.' },
    { text: '整军再战 — Reform the lines. A disciplined army outfights one twice its number.' },
    { text: '阵法为先 — Formation first. Zhuge Liang\'s Eight Trigrams Formation confounded even Sima Yi.' },
    { text: '纪律严明 — Strict discipline wins battles. Reform and prepare for the next engagement.' },
    { text: '散兵归阵 — Stragglers back to formation. An army without order is merely a mob.' },
  ],

  RALLY: [
    { text: '集结！ — Rally to the banner! A broken army can be reforged if the general still stands.' },
    { text: '聚沙成塔 — Gather grains of sand to build a tower. Rally the scattered and fight on.' },
    { text: '化零为整 — From fragments, reform the whole. Guan Yu rallied his men at Fancheng against all odds.' },
    { text: '旗在人在 — Where the banner stands, the army stands. Rally!' },
    { text: '军心未散 — The spirit of the army holds. Regroup and we fight again.', conditions: { morale: 'low' } },
  ],

  DISENGAGE: [
    { text: '脱离战斗 — Break contact cleanly. 知不可战则勿战 — if you cannot win, do not fight.' },
    { text: '金蝉脱壳 — Slip away like the golden cicada sheds its shell. Live to fight another day.' },
    { text: '走为上策 — Withdrawal is the superior strategy when the odds turn against you.' },
    { text: '避实击虚 — Avoid their strength, strike their weakness. Disengage and reposition.' },
    { text: '脱身而退 — Extract cleanly. A unit in good order is worth three that fought to the last.' },
  ],

  MOVE: [
    { text: '调兵遣将 — Reposition for advantage. The army that arrives first holds the initiative.' },
    { text: '兵马未动粮草先行 — Before troops move, supply moves first. But sometimes, speed decides all.' },
    { text: '善战者动于九天之上 — The skilled commander moves as if descending from the ninth heaven.' },
    { text: '运筹帷幄 — Strategy from the command tent. Control the terrain, control the battle.' },
    { text: '行军如风 — March like the wind. Swiftness denies the enemy time to react.' },
    { text: '夜行军需格外谨慎 — Night marches demand extra caution. Move carefully.', conditions: { timeOfDay: 'night' } },
  ],
};

// Weather-specific overlays appended to any order type
const WEATHER_COMMENTARY: Record<string, string[]> = {
  rain: [
    '大雨之中弓弩无用 — Bowstrings are useless in this rain.',
    '泥泞迟缓，步步艰难 — Mud slows every step.',
  ],
  fog: [
    '雾中藏兵 — The fog conceals both friend and foe. At Red Cliffs, Zhuge Liang used fog to borrow arrows.',
    '雾锁战场 — Vision is limited; trust your scouts.',
  ],
  wind: [
    '顺风而战 — Fight with the wind at your back; fire and arrows fly truer.',
    '风起云涌 — The wind shifts the balance of the field.',
  ],
  snow: [
    '雪中行军倍加艰辛 — Marching through snow drains stamina twice as fast.',
    '白雪覆野 — Snow reveals movement. Plan accordingly.',
  ],
};

// Casualties-specific overlays
const CASUALTY_COMMENTARY: Record<string, string[]> = {
  heavy: [
    '伤亡惨重，然大势未去 — Casualties are grievous, but the tide has not turned.',
    '损失虽大，犹可一战 — Great loss, but the fight remains ours.',
  ],
  light: [
    '我军伤亡甚微 — Our losses are minimal; press the advantage.',
  ],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export class TemplateCommentary {
  /**
   * Get a contextually relevant commentary string.
   * Always returns a bilingual (Chinese + English) response.
   */
  static get(context: CommentaryContext): string {
    const orderKey = context.orderType?.toUpperCase() ?? 'MOVE';
    const templates = ORDER_TEMPLATES[orderKey] ?? ORDER_TEMPLATES.MOVE;

    // Try to find a condition-matched template first
    const matched = templates.filter(t => {
      if (!t.conditions) return false;
      if (t.conditions.weather && t.conditions.weather !== context.weather) return false;
      if (t.conditions.morale && t.conditions.morale !== context.morale) return false;
      if (t.conditions.casualties && t.conditions.casualties !== context.casualties) return false;
      return true;
    });

    // If we have a condition match, use it ~60% of the time; otherwise pick any
    const pool = matched.length > 0 && Math.random() < 0.6 ? matched : templates;
    let result = pickRandom(pool).text;

    // Occasionally append weather commentary (~30% chance if weather is notable)
    if (context.weather && WEATHER_COMMENTARY[context.weather] && Math.random() < 0.3) {
      result += ' ' + pickRandom(WEATHER_COMMENTARY[context.weather]);
    }

    // Occasionally append casualty commentary (~25% chance)
    if (context.casualties && CASUALTY_COMMENTARY[context.casualties] && Math.random() < 0.25) {
      result += ' ' + pickRandom(CASUALTY_COMMENTARY[context.casualties]);
    }

    return result;
  }
}
