import React from 'react'
import { ConversationInterface } from '../../components/conversation/ConversationInterface'

export function ChatNewPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <ConversationInterface />
    </div>
  )
}