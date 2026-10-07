import assert from 'node:assert/strict'
import { test } from 'node:test'
import { photoCountdownDeadline, remainingPhotoSeconds, photoProgressMessage, photoQueuePosition, queueCountdown, photoQueueOrdinalSuffix, photoProcessingOverrunStep } from '../src/features/custom-photo/model/photoProgress.ts'

const queued = (position = 5, wait = 30) => ({ stage: 'queued', photo: { job: { status: 'queued', queuePosition: position, estimatedWaitSeconds: wait } } })
test('queue position is hidden for first place, processing, and missing jobs', () => {
  assert.equal(photoQueuePosition(queued()), 5)
  assert.equal(photoQueuePosition(queued(1)), null)
  assert.equal(photoQueuePosition(queued(0)), null)
  assert.equal(photoQueuePosition({ ...queued(), stage: 'processing' }), null)
  assert.equal(photoQueuePosition({ stage: 'uploading' }), null)
})
test('queue countdown uses the server wait and catches up after a suspended tab', () => {
  const deadline = photoCountdownDeadline(queued(), 1000, 0)
  assert.equal(remainingPhotoSeconds(deadline, 1000), 30)
  assert.equal(remainingPhotoSeconds(deadline, 2000), 29)
  assert.equal(remainingPhotoSeconds(deadline, 3000), 28)
  assert.equal(remainingPhotoSeconds(deadline, 100000), 0)
  assert.equal(photoProgressMessage(queued(), 0), 'Waiting')
})
test('processing countdown resumes from server start rather than resetting on polling or refresh', () => {
  const state = { stage: 'processing', photo: { job: { startedAt: '2030-01-01T00:00:00.000Z', estimatedWaitSeconds: 0 } } }
  const start = Date.parse(state.photo.job.startedAt)
  const deadline = photoCountdownDeadline(state, start + 10000, start + 10000)
  assert.equal(remainingPhotoSeconds(deadline, start + 10000), 20)
  assert.equal(photoCountdownDeadline(state, start + 20000, start + 20000), deadline)
  assert.equal(photoProgressMessage(state, remainingPhotoSeconds(deadline, start + 31000)), 'Taking a little longer…')
})
test('missing processing start uses a stable first observation and terminal states have no countdown', () => {
  const state = { stage: 'processing' }
  assert.equal(photoCountdownDeadline(state, 5000, 1000), 31000)
  for (const stage of ['loading', 'uploading', 'receiving', 'ready', 'error', 'cancelled']) {
    assert.equal(photoCountdownDeadline({ stage }, 1000, 1000), null)
  }
  assert.equal(remainingPhotoSeconds(null, 1000), null)
  assert.equal(photoProgressMessage({ stage: 'processing', notice: 'Reconnecting… Your photo is saved.' }, 0), 'Reconnecting…')
})

test('identical queue polls preserve the countdown while new positions and estimates refresh it', () => {
  const job = { ...queued().photo.job, jobId: 'job-1234' }
  const first = queueCountdown(job, 1000, null)
  const repeat = queueCountdown({ ...job }, 3000, first)
  assert.equal(repeat, first)
  assert.equal(remainingPhotoSeconds(repeat.deadline, 3000), 28)
  const advanced = queueCountdown({ ...job, queuePosition: 4, estimatedWaitSeconds: 20 }, 4000, repeat)
  assert.equal(remainingPhotoSeconds(advanced.deadline, 4000), 20)
  const other = queueCountdown({ ...job, jobId: 'job-5678' }, 5000, advanced)
  assert.equal(remainingPhotoSeconds(other.deadline, 5000), 30)
})

test('queue ordinals use English endings including teen exceptions and later hundreds', () => {
  for (const [position, suffix] of [[1, 'st'], [2, 'nd'], [3, 'rd'], [5, 'th'], [11, 'th'], [12, 'th'], [13, 'th'], [21, 'st'], [22, 'nd'], [23, 'rd'], [111, 'th'], [112, 'th'], [113, 'th'], [121, 'st']]) {
    assert.equal(photoQueueOrdinalSuffix(position), suffix)
  }
})

test('overrun phrases rotate every five seconds after processing exceeds its estimate', () => {
  const deadline = 30000
  const state = { stage: 'processing' }
  const message = now => photoProgressMessage(state, remainingPhotoSeconds(deadline, now), photoProcessingOverrunStep(deadline, now))
  assert.equal(message(29000), 'Removing background')
  assert.equal(message(30000), 'Taking a little longer…')
  assert.equal(message(34999), 'Taking a little longer…')
  assert.equal(message(35000), 'Still working on it…')
  assert.equal(message(40000), 'A little more time…')
  assert.equal(message(45000), 'We’re on it…')
  assert.equal(message(50000), 'Taking a little longer…')
  assert.equal(photoProcessingOverrunStep(null, 50000), 0)
  assert.equal(photoProgressMessage(queued(), 0, 3), 'Waiting')
  assert.equal(photoProgressMessage({ stage: 'ready' }, null, 3), 'Preparing')
  assert.equal(photoProgressMessage({ stage: 'processing', notice: 'Reconnecting…' }, 0, 3), 'Reconnecting…')
})

test('uploading and queued stages have distinct status messages', () => {
  assert.equal(photoProgressMessage({ stage: 'uploading' }, null), 'Uploading')
  assert.equal(photoProgressMessage(queued(1, 0), 0), 'Waiting')
})
