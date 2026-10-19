

// 特效表
// frameTime = 每帧播放秒数，总时长 = frames × frameTime
export const FX_CONFIG = {
    /** 受击 */
    hit: { src: './imgs/fx/hit.png', frames: 4, w: 64, h: 64, frameTime: 0.1 },
    /** 回血 */
    heal: { src: './imgs/fx/heal.png', frames: 4, w: 48, h: 48, frameTime: 0.12 },
    /** 升级 */
    levelup: { src: './imgs/fx/levelup.png', frames: 6, w: 128, h: 128, frameTime: 0.1 },
}

// 游戏状态 前-》中-》后
export const GAME_STATUS_EARLY = 'early'
export const GAME_STATUS_MID = 'mid'
export const GAME_STATUS_LATE = 'late'