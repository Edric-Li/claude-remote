import { io, Socket } from 'socket.io-client'

let socketInstance: Socket | null = null

export function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io('http://localhost:3000', {
      autoConnect: false
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