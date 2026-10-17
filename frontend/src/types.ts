export type FlowType = 'supervision' | 'self_ticket' | 'info_notice' | 'normal_comm'

export interface VoiceEntry {
  sec: number
  text: string
  keys: string[]
}

export interface FlowEvent {
  sec: number
  flowType: FlowType
  name: string
  color: string
  isStart: boolean
  // 规则层的流程编号（同一 flowType 内自增）：仅用于"同一秒内多条流程通知"
  // 的稳定排序，见 useNotify.addFlow
  flowId?: number
}

export interface SegCard {
  flowId: string
  flowType: FlowType
  score: number
  reportText: string
  continueSec: number | string
  collapsed: boolean
  streamBuffer: string
  streaming: boolean
}

export interface GazeState {
  hasHeads: boolean
  headsCount: number
  anyInRoi: boolean
  awayDuration: number
}

export interface PeopleState {
  count: number | string
  alert: string
  alertColor: string
}
