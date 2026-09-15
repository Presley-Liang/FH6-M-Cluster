export function createRaceFeedbackController({ bestTolerance = 0.005 } = {}) {
  let armed = false, prior = null, lastRewindId = null;
  const finite = Number.isFinite;
  const context = packet => ({ sessionId:packet.sessionId, raceOn:!!packet.isRaceOn,
    lap:Number.isSafeInteger(packet.lapNumber)?packet.lapNumber:null,
    best:finite(packet.bestLap)&&packet.bestLap>0?Number(packet.bestLap):null,
    rank:Number.isSafeInteger(packet.racePosition)&&packet.racePosition>0?packet.racePosition:null });
  function reset() { armed=false;prior=null; }
  function update(packet = {}, { active = true, stale = false } = {}) {
    if (!active || stale || packet.sessionId == null) { reset();return []; }
    const next=context(packet);
    const rewindId=packet.timelineBreak==='rewind'?`${packet.sessionId}:${packet.arrivalIndex??packet.currentRaceTime??'rewind'}`:null;
    if (!armed || !prior || prior.sessionId!==next.sessionId) {armed=true;prior=next;return [];}
    if (packet.timelineBreak != null) {prior=next;if(rewindId&&rewindId!==lastRewindId){lastRewindId=rewindId;return [{id:`rewind:${rewindId}`,type:'rewind',tone:'caution'}];}return [];}
    const events=[];
    if(!prior.raceOn&&next.raceOn)events.push({id:`${next.sessionId}:start`,type:'race-start',tone:'accent'});
    const completed=prior.raceOn&&next.raceOn&&prior.lap!==null&&next.lap===prior.lap+1&&finite(packet.lastLap)&&packet.lastLap>0;
    if(completed){const isBest=next.best!==null&&(prior.best===null||next.best<prior.best-bestTolerance)&&Math.abs(next.best-packet.lastLap)<=bestTolerance;events.push({id:`${next.sessionId}:lap:${prior.lap}`,type:isBest?'new-best':'lap-complete',tone:isBest?'success':'accent',lap:prior.lap,seconds:Number(packet.lastLap)});}
    if(prior.raceOn&&next.raceOn&&prior.rank!==null&&next.rank!==null&&prior.rank!==next.rank)events.push({id:`${next.sessionId}:position:${packet.arrivalIndex??next.lap+':'+next.rank}`,type:next.rank<prior.rank?'position-gain':'position-loss',tone:next.rank<prior.rank?'success':'caution',rank:next.rank,delta:prior.rank-next.rank});
    if(next.lap!==null&&prior.lap!==null&&next.lap<prior.lap)events.length=0;
    prior=next;return events;
  }
  return {update,reset};
}
