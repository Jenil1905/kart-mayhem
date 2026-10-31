import { io } from 'socket.io-client';

async function runTests() {
  console.log('--- TEST 1: Created Room Must Have ZERO Bots ---');
  const s1 = io('http://localhost:3000', { reconnection: false });

  await new Promise(r => s1.on('connect', r));
  console.log('Socket 1 connected:', s1.id);

  const createRes = await new Promise(r => s1.emit('create_room', { profile: { name: 'RoomHost' } }, r));
  console.log('Create room result:', createRes);
  if (!createRes.success) throw new Error('Failed to create room');

  // Wait for a game tick from created room
  const tick1 = await new Promise(r => s1.once('game_tick', r));
  console.log(`Created Room ${createRes.roomId} tick: Players = ${tick1.players.length}, Bots = ${tick1.bots.length}`);
  if (tick1.bots.length !== 0) {
    throw new Error(`FAIL: Created room has ${tick1.bots.length} bots! Expected 0 bots!`);
  }
  console.log('✓ PASS: Created room has 0 bots (empty of NPCs)!');

  console.log('\n--- TEST 2: Friend Joining Created Room ---');
  const s2 = io('http://localhost:3000', { reconnection: false });
  await new Promise(r => s2.on('connect', r));

  const joinRes = await new Promise(r => s2.emit('join_room', { roomId: createRes.roomId, profile: { name: 'FriendPlayer' } }, r));
  console.log('Join room result:', joinRes);
  if (!joinRes.success) throw new Error('Failed to join room');

  const tick2 = await new Promise(r => s1.once('game_tick', r));
  console.log(`Created Room after friend join: Players = ${tick2.players.length}, Bots = ${tick2.bots.length}`);
  if (tick2.players.length !== 2 || tick2.bots.length !== 0) {
    throw new Error(`FAIL: Expected 2 human players and 0 bots! Got ${tick2.players.length} players, ${tick2.bots.length} bots`);
  }
  console.log('✓ PASS: Custom room has only human friends, zero NPCs!');

  console.log('\n--- TEST 3: Item Box Collection & Power Awarding ---');
  // s1 emits hit_item_box
  let weaponAwarded = null;
  s1.on('item_box_collected', (data) => {
    console.log('Received item_box_collected event:', data);
    weaponAwarded = data;
  });

  // Position player near box 1 (at x=0, z=0)
  s1.emit('player_input', { x: 0.5, y: 0, z: 0.5, rotY: 0, speed: 5 });
  await new Promise(r => setTimeout(r, 100));

  s1.emit('hit_item_box', { boxId: 1 });
  await new Promise(r => setTimeout(r, 300));

  if (!weaponAwarded || !weaponAwarded.weaponType) {
    throw new Error('FAIL: Weapon was not awarded from item box!');
  }
  console.log(`✓ PASS: Item box successfully awarded power: ${weaponAwarded.weaponType} with ${weaponAwarded.ammo} ammo!`);

  console.log('\n--- TEST 4: Quick Play Should Have Bots ---');
  const s3 = io('http://localhost:3000', { reconnection: false });
  await new Promise(r => s3.on('connect', r));

  const qpRes = await new Promise(r => s3.emit('quick_play', { profile: { name: 'QuickPlayUser' } }, r));
  console.log('Quick play result:', qpRes);

  const qpTick = await new Promise(r => s3.once('game_tick', r));
  console.log(`Quick Play Room ${qpRes.roomId} tick: Players = ${qpTick.players.length}, Bots = ${qpTick.bots.length}`);
  if (qpTick.bots.length === 0) {
    throw new Error('FAIL: Quick play room expected bots but had 0!');
  }
  console.log(`✓ PASS: Quick Play has ${qpTick.bots.length} NPCs/Bots active!`);

  s1.disconnect();
  s2.disconnect();
  s3.disconnect();
  console.log('\n========================================');
  console.log('ALL VERIFICATION TESTS PASSED 100%!');
  console.log('========================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
