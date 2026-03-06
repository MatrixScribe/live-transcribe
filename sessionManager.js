export const sessions = new Map()

export function createSession(id, socket){
  sessions.set(id,{
    id,
    socket,
    speaker:1,
    transcript:""
  })
}

export function getSession(id){
  return sessions.get(id)
}

export function removeSession(id){
  sessions.delete(id)
}
