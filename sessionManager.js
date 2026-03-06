import { v4 as uuidv4 } from "uuid"
import RealtimeSession from "./realtimeSession.js"

const sessions = new Map()

export function createSession(ws) {

  const id = uuidv4()

  const session = new RealtimeSession(ws)

  sessions.set(id, session)

  return id

}

export function getSession(id) {

  return sessions.get(id)

}

export function removeSession(id) {

  const session = sessions.get(id)

  if (session) {

    session.close()

    sessions.delete(id)

  }

}
