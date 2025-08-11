// Session调试工具
import { useSessionStoreBase } from '../store/session.store'

// 导出到全局window对象，方便控制台调试
if (typeof window !== 'undefined') {
  ;(window as any).sessionDebug = {
    // 获取当前Store状态
    getState: () => {
      const state = useSessionStoreBase.getState()
      const currentSession = state.sessions.find(s => s.id === state.currentSessionId) || null
      console.log('=== Session Store State ===')
      console.log('sessions:', state.sessions)
      console.log('currentSessionId:', state.currentSessionId)
      console.log('currentSession:', currentSession)
      console.log('loading:', state.loading)
      console.log('error:', state.error)
      return { ...state, currentSession }
    },

    // 手动选择会话
    selectSession: (id: string) => {
      console.log(`Selecting session: ${id}`)
      useSessionStoreBase.getState().selectSession(id)
    },

    // 获取所有会话
    getSessions: () => {
      return useSessionStoreBase.getState().sessions
    },

    // 获取当前会话
    getCurrentSession: () => {
      const state = useSessionStoreBase.getState()
      return state.sessions.find(s => s.id === state.currentSessionId) || null
    },

    // 加载会话列表
    loadSessions: async () => {
      console.log('Loading sessions from server...')
      await useSessionStoreBase.getState().loadSessions()
      console.log('Sessions loaded:', useSessionStoreBase.getState().sessions)
    }
  }

  console.log('%c Session Debug Tools Loaded', 'background: #4a5568; color: #fbbf24')
  console.log('Available commands:')
  console.log('- sessionDebug.getState() - 查看Store状态')
  console.log('- sessionDebug.getSessions() - 获取所有会话')
  console.log('- sessionDebug.getCurrentSession() - 获取当前会话')
  console.log('- sessionDebug.selectSession(id) - 选择会话')
  console.log('- sessionDebug.loadSessions() - 从服务器加载会话')
}
