import { io, Socket } from 'socket.io-client'

let socketInstance: Socket | null = null

export function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io('http://localhost:3000', {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    })
  }
  return socketInstance
}

export function cleanupSocket(): void {
  if (socketInstance) {
    socketInstance.off()
    socketInstance.disconnect()
    socketInstance = null
  }
}