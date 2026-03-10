import { normalizeLevelDefinition } from './levelSchema';
import type { LevelDefinition } from './levelSchema';

// FILE_SIZE_EXCEPTION: The shipped launch catalog stays in one file by explicit user request so
// future level-order edits live in one place.
// Launch order is maintained with tools/scripts/rank-levels.ts using the default difficulty heuristic.

const launchLevels: LevelDefinition[] = [
  {
    id: 'corgiban-test-1',
    name: 'Paws Off That',
    // prettier-ignore
    rows: [
      'WWWWWWWW',
      'WWWTWWWW',
      'WWW WWWW',
      'WWWB BTW',
      'WT BPWWW',
      'WWWWBWWW',
      'WWWWTWWW',
      'WWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-2',
    name: 'Splooty Heist',
    // prettier-ignore
    rows: [
      'WWWWWWW',
      'WTP W W',
      'WBS B W',
      'W   B W',
      'W TT  W',
      'W  S  W',
      'WWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-3',
    name: 'Tiny Tantrum',
    // prettier-ignore
    rows: [
      'WWWWWW',
      'W TWWW',
      'W  WWW',
      'WSP  W',
      'W  B W',
      'W  WWW',
      'WWWWWW',
    ],
  },
  {
    id: 'corgiban-test-4',
    name: 'Floof Rage',
    // prettier-ignore
    rows: [
      'WWWWWWW',
      'WT B TW',
      'WTBBBPW',
      'WT B TW',
      'WWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-5',
    name: 'Squirrel Alert',
    // prettier-ignore
    rows: [
      'WWWWWW',
      'WT  WW',
      'WPBB W',
      'WW   W',
      'WWW  W',
      'WWWWTW',
      'WWWWWW',
    ],
    knownSolution: 'URRDULLDRDRLUURDRDDLURULDLURUL',
  },
  {
    id: 'corgiban-test-6',
    name: 'Snoot Boop Maze',
    // prettier-ignore
    rows: [
      'WWWWWWW',
      'WW  T W',
      'W S W W',
      'W TB  W',
      'W  WBWW',
      'WW P WW',
      'WWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-7',
    name: 'Forbidden Puddle',
    // prettier-ignore
    rows: [
      'WWWWWWWW',
      'WWWP WWW',
      'WWW BWWW',
      'W BBTWWW',
      'W BTT WW',
      'W BTT WW',
      'W   WWWW',
      'WWWWWWWW',
    ],
    knownSolution: 'RDDDLDDLLUURRURUULDDDLLURRLLDDDRULUR',
  },
  {
    id: 'corgiban-test-8',
    name: 'Offended Biscuit',
    // prettier-ignore
    rows: [
      'WWWWWWWWW',
      'WWW Q   W',
      'WWW W W W',
      'WWW W   W',
      'WWWSBSWWW',
      'W   S   W',
      'W W W W W',
      'W   W   W',
      'WWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-9',
    name: 'Zoomies Denied',
    // prettier-ignore
    rows: [
      'WWWWWWWW',
      'W   WWWW',
      'W W SPWW',
      'W  S   W',
      'WWWB   W',
      'WWW   TW',
      'WWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-10',
    name: 'Shoe Thief',
    // prettier-ignore
    rows: [
      'WWWWWWWW',
      'W  BT  W',
      'W  BT  W',
      'WWW  WWW',
      'W  BT  W',
      'WP BT  W',
      'WWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-11',
    name: 'No Takebacks',
    // prettier-ignore
    rows: [
      'WWWWWWWW',
      'W      W',
      'W WWWW W',
      'W W  W W',
      'W W  W W',
      'W W  W W',
      'W WBBW W',
      'W  BPT W',
      'WWW TTWW',
      'WWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-12',
    name: 'Tippy Tap Fury',
    // prettier-ignore
    rows: [
      'WWWWWWWWW',
      'WWWW  WWW',
      'WWWWBT  W',
      'W   S T W',
      'WPWTWBW W',
      'W B S   W',
      'W  TBWWWW',
      'WWW  WWWW',
      'WWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-13',
    name: 'Mailman Vendetta',
    // prettier-ignore
    rows: [
      'WWWWWWWW',
      'W     PW',
      'W SSSB W',
      'WWS B  W',
      'W TB SWW',
      'W TSTS W',
      'W      W',
      'WWWWWWWW',
    ],
    knownSolution: 'LDULLDRDDUUULLLDRDDUUURRDDDLRULRULURRRDDLLDLURRRUL',
  },
  {
    id: 'corgiban-test-14',
    name: 'Vet Trip Escape',
    // prettier-ignore
    rows: [
      'WWWWWWWW',
      'WWWWW  W',
      'WWW    W',
      'WT  BWPW',
      'WTTB B W',
      'WWWT B W',
      'WWWWW  W',
      'WWWWWWWW',
    ],
    knownSolution: 'ULLDDLLRRUURRDDLLLRRRDDLURULRUULLLDDDRLUUURRRDDLLDLURULLRDRRRDLL',
  },
  {
    id: 'corgiban-test-15',
    name: 'Bork Bork Bork',
    // prettier-ignore
    rows: [
      'WWWWWW',
      'W  WWW',
      'W  WWW',
      'W  WWW',
      'WTBBPW',
      'W  T W',
      'W  WWW',
      'WWWWWW',
    ],
  },
  {
    id: 'corgiban-test-16',
    name: 'Treat Heist',
    // prettier-ignore
    rows: [
      'WWWWWWWWWWWW',
      'WWW   T    W',
      'W   WWBWW  W',
      'W PBT T TBWW',
      'WW BWWBWW WW',
      'WW    T   WW',
      'WWWWWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-17',
    name: 'Trash Panda Rival',
    // prettier-ignore
    rows: [
      'WWWWWWWW',
      'W BTWWWW',
      'W  TT WW',
      'W  WWBWW',
      'WW  W  W',
      'WWB    W',
      'WWP WWWW',
      'WWWWWWWW',
    ],
    knownSolution: 'UUULUURDRRRDDRDLLLULULURRLDDRDDLUUULUR',
  },
  {
    id: 'corgiban-test-18',
    name: 'Counter Surfer',
    // prettier-ignore
    rows: [
      'WWWWWWWWW',
      'W    WWWW',
      'W BBBWWWW',
      'W  WTTWWW',
      'WW  TTB W',
      'WW P    W',
      'WWWWWWWWW',
    ],
    knownSolution: 'LUULUURRRDDRDLDLLUULUURDRURDDRDDLUDRRRULDLUDLLLURRLLULUURRRDDUULLLDRRURD',
  },
  {
    id: 'corgiban-test-19',
    name: 'Stolen Blanket',
    // prettier-ignore
    rows: [
      'WWWWWWWW',
      'WWW   WW',
      'W  BW WW',
      'W TBTP W',
      'WW B W W',
      'WWW T  W',
      'WWWWWWWW',
    ],
    knownSolution:
      'LLRDDLULURDDRRRUULUULLDDLLURDDRDRRRUULLDULDLURRRUULLDDLLURDDRURRUULLDURRDDLLDDRULUUURRDDRDDL',
  },
  {
    id: 'corgiban-test-20',
    name: 'Smol But Fierce',
    // prettier-ignore
    rows: [
      'WWWWWWW',
      'WWW  WW',
      'W   B W',
      'W WTWPW',
      'W WB TW',
      'W  TB W',
      'WW   WW',
      'WWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-21',
    name: 'Pillow Fortress',
    // prettier-ignore
    rows: [
      'WWWWWWW',
      'WWW   W',
      'WWW WTW',
      'WWW  TW',
      'W BB  W',
      'WPBT  W',
      'WWWWWWW',
    ],
    knownSolution: 'RRUUDDLLURRURRDDLULLDRURRUUULLDDRDRUDLLDLLURRURRDDLULUR',
  },
  {
    id: 'corgiban-test-22',
    name: 'Sniffy Business',
    // prettier-ignore
    rows: [
      'WWWWWWWWW',
      'WWWWT  PW',
      'W  BBB  W',
      'WTWWTWWTW',
      'W   B   W',
      'W  BTW WW',
      'WWWW   WW',
      'WWWWWWWWW',
    ],
    knownSolution:
      'DDDLDDLLULURDDRRUURUUULLLDDDUURLDDLLLUURRLLDDRRRUURURRDDDLDDLLUUDLULLDRURRDDRRUULLLLDLURDRURRRRUUULLDRURD',
  },
  {
    id: 'corgiban-test-23',
    name: 'Dramatic Flop',
    // prettier-ignore
    rows: [
      'WWWWWWWWWWWWW',
      'WWWWW       W',
      'WWWWWBWWWWW W',
      'W         W W',
      'W WWW WWW W W',
      'W WTTB TW W W',
      'W WTS BTW W W',
      'W WWW WWW W W',
      'W    B    W W',
      'WWWWWBWWWWW W',
      'WWWWWP      W',
      'WWWWWWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-24',
    name: 'Ear Flop Express',
    // prettier-ignore
    rows: [
      'WWWWWWWW',
      'WWWWPWWW',
      'WWWWTWWW',
      'WWT    W',
      'W BBB  W',
      'WT  WWWW',
      'W  WWWWW',
      'WWWWWWWW',
    ],
    knownSolution: 'DDLLDLDDRURURLDLLURURLDDRURURRDLLLDLLURURRDLULDRDLRURRRULLL',
  },
  {
    id: 'corgiban-test-25',
    name: 'Derp Sprint',
    // prettier-ignore
    rows: [
      'WWWWWWW',
      'WW T WW',
      'W BTBWW',
      'W PTB W',
      'W BT  W',
      'W BTBWW',
      'WW T WW',
      'WWWWWWW',
    ],
    knownSolution:
      'LUDDDRURRRULDLLLUURURRDDRDLUUULLDDUURRDDLULLDRLDDRULUURRRDDLRUULLLDDDRDRRUULDLLUUURRRDRDULULLLDDDRRUUDDLLURLUURDRDURRDLULLLDDRULUR',
  },
  {
    id: 'corgiban-test-26',
    name: 'Doorbell Meltdown',
    // prettier-ignore
    rows: [
      'WWWWWWWW',
      'WW P  WW',
      'W B BB W',
      'WTTTTTTW',
      'W BB B W',
      'WWW  WWW',
      'WWWWWWWW',
    ],
    knownSolution:
      'RRDLDDDLURUURRDULLULLDLDDRLUURRLLDDRRDRULULUURRRDRDDUULULLDURLLDDDRULUURRRDRDDLRUULULLDURRDLULLDDDRRUDLLUUURRRDRDDLLURUULLLDDRLUURRRDDLLRDDLURRUUULDULLDRRURD',
  },
  {
    id: 'corgiban-test-27',
    name: 'Butt Wiggle Push',
    // prettier-ignore
    rows: [
      'WWWWWWWWW',
      'WWW   WWW',
      'WW  W  WW',
      'WW TBT WW',
      'W BBTBB W',
      'W TBBBT W',
      'WW TQT WW',
      'WWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-28',
    name: 'Grumpy Waddle',
    // prettier-ignore
    rows: [
      'WWWWWWWWWW',
      'W   W    W',
      'W WBBBBB W',
      'W  TWTW  W',
      'W  TTT  WW',
      'WWW P WWWW',
      'WWWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-29',
    name: 'Couch Potato King',
    // prettier-ignore
    rows: [
      'WWWWWWWWW',
      'WWW P WWW',
      'WWW W WWW',
      'W BBWBB W',
      'W TT T  W',
      'WW  WTBWW',
      'WW   T WW',
      'WWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-30',
    name: 'Dinner Dance',
    // prettier-ignore
    rows: [
      'WWWWWWWW',
      'WTT    W',
      'WTTB B W',
      'WBWBBBWW',
      'WTTB BPW',
      'WTT    W',
      'WWWWWWWW',
    ],
    knownSolution: 'DLLUUDLDLLUUURURRDLLRDDRDLLRULRDRRRULLLUURDDRDLLUUUURRRDLLLDDRRUURULLL',
  },
  {
    id: 'corgiban-test-31',
    name: 'Good Boy Detour',
    // prettier-ignore
    rows: [
      'WWWWWWWWW',
      'WW PTTTWW',
      'WW   WWWW',
      'WWWB    W',
      'W   WBW W',
      'W B W   W',
      'W   WWWWW',
      'WWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-32',
    name: 'Peanut Butter Toll',
    // prettier-ignore
    rows: [
      'WWWWWWWW',
      'WT    TW',
      'W W WW W',
      'W  B T W',
      'W W WW W',
      'WBBBSW W',
      'WT  PBTW',
      'WWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-33',
    name: 'Who Chewed This',
    // prettier-ignore
    rows: [
      'WWWWWWWWWWW',
      'WWW  WWWWWW',
      'W   P   WWW',
      'W WT TWTWWW',
      'W BBB BBB W',
      'WWWTWTWTW W',
      'WWW       W',
      'WWWWWW  WWW',
      'WWWWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-34',
    name: 'Snack Embargo',
    // prettier-ignore
    rows: [
      'WWWWWWWW',
      'W    WWW',
      'W TB WWW',
      'W SS WWW',
      'WWBT WWW',
      'WW  WWWW',
      'WW WW  W',
      'WW  W  W',
      'WW     W',
      'WWTSSBPW',
      'WW  W  W',
      'WWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-35',
    name: 'Mud Paw Prints',
    // prettier-ignore
    rows: [
      'WWWWWWWW',
      'WWWW   W',
      'WPB  W W',
      'W BBB  W',
      'WWTWT  W',
      'W  TTW W',
      'W  WTS W',
      'W BTB WW',
      'WWW   WW',
      'WWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-36',
    name: 'Lap Hijack',
    // prettier-ignore
    rows: [
      'WWWWWWW',
      'WP WWWW',
      'W     W',
      'W   SBW',
      'WWW STW',
      'W B W W',
      'W   T W',
      'WWWWWWW',
    ],
    knownSolution:
      'DRRRRDLLDDDRRUULRDDLLUUDDLLURDRRRUULLDURRDDLLUURUULDULLDRURRRLDLULLRRDDUULLDRURRDDLURULDDRRDDLLUUDLLDURRURUURDDLLULLUURDLDRRDRRUULDULDLLUURDLDRRDDDRRUDLLULLDRR',
  },
  {
    id: 'corgiban-test-37',
    name: 'Bark At Nothing',
    // prettier-ignore
    rows: [
      'WWWWWWWWWWW',
      'WTTTWW B TW',
      'WW   B WBWW',
      'W  BW     W',
      'WWB  B WB W',
      'WT  W BTTTW',
      'WWWWWPWWWWW',
      'WWWWWWWWWWW',
    ],
    knownSolution:
      'URRRLLLURUULLLRRRDDLLLULURLDDRDLUUURULRDDDRRRUULLLDLUDDRRRURULLRDDLLUURRRURRLLDDDDRRURULLLUURRDDDULLULDULLDDRRURDLDR',
  },
  {
    id: 'corgiban-test-38',
    name: 'Toy Graveyard',
    // prettier-ignore
    rows: [
      'WWWWWWW',
      'W  S  W',
      'W TSTTW',
      'W  B  W',
      'WW BWWW',
      'WWPB WW',
      'WW   WW',
      'WWWWWWW',
    ],
    knownSolution:
      'UUUURLDDRLDDDRRULDLUUURDLULUURRDRRULLDDLLURRLDDDDRRULDLUUURDUUURRDDLRUULLDDURLDLLURRLLURDDDDDRRULDLUUUDDRUU',
  },
  {
    id: 'corgiban-test-39',
    name: 'Yard Patrol',
    // prettier-ignore
    rows: [
      'WWWWWWWWWWW',
      'WWWW WWWWWW',
      'WWW  WWW  W',
      'WW B      W',
      'W   PB W  W',
      'WWW BWWW  W',
      'WWW  WTT  W',
      'WWW WWTW WW',
      'WW      WWW',
      'WW     WWWW',
      'WWWWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-40',
    name: 'Herding Chaos',
    // prettier-ignore
    rows: [
      'WWWWWWWWWWW',
      'WWW   W  PW',
      'WWW  TBTW W',
      'WW  WW  B W',
      'WW  TBSWBWW',
      'W  WBW   WW',
      'W  T TW WWW',
      'WWWW    WWW',
      'WWWWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-41',
    name: 'Escape Artist',
    // prettier-ignore
    rows: [
      'WWWWWWWW',
      'W  TWP W',
      'W  BB  W',
      'WT TW  W',
      'WW BW WW',
      'WW S  WW',
      'WW  WWWW',
      'WWWWWWWW',
    ],
    knownSolution:
      'DDDDLLDLUUURDULLUURRDLULDRDDRLUURRLLDDRUDLDDRURRUURUULDLLDLDDRRRUURULDDDLLLUURDUUULDRDDLDDRURRUUULLDDLDRUUUULLDRURDDDLUULURDDDDDRUULUURRRDDDL',
  },
  {
    id: 'corgiban-test-42',
    name: 'Kibble Logistics',
    // prettier-ignore
    rows: [
      'WWWWWWWWWW',
      'WWW    WWW',
      'WWW B    W',
      'WWW B WW W',
      'WTTT B   W',
      'WTTTBWB WW',
      'WWWW W B W',
      'WWWW  P  W',
      'WWWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-43',
    name: 'Fridge Stakeout',
    // prettier-ignore
    rows: [
      'WWWWWWWWWWWWW',
      'WWW      WWWW',
      'WWW WW W WWWW',
      'W  STSS TS  W',
      'W  B   BW P W',
      'WWWWWWW   WWW',
      'WWWWWWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-44',
    name: 'Dramatic Sigh',
    // prettier-ignore
    rows: [
      'WWWWWWWWWW',
      'WWW  WWWWW',
      'WW  B  P W',
      'WW  BW   W',
      'WWWW WWWWW',
      'W  W   WWW',
      'W    B WWW',
      'W TTW  WWW',
      'W  TWWWWWW',
      'W  WWWWWWW',
      'WWWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-45',
    name: 'Selective Hearing',
    // prettier-ignore
    rows: [
      'WWWWWWWWWW',
      'W   WWWWWW',
      'W B B B WW',
      'WWW W W WW',
      'WWW W   WW',
      'WWW WWW WW',
      'WW TTTTTPW',
      'WW B B   W',
      'WW WWW WWW',
      'WW     WWW',
      'WWWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-46',
    name: 'Stubborn Sploot',
    // prettier-ignore
    rows: [
      'WWWWWWWWW',
      'WP  W  WW',
      'W TT   WW',
      'WWTWW   W',
      'WW  BBW W',
      'WWWWB   W',
      'WWWW  WWW',
      'WWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-47',
    name: 'Sock Bandit',
    // prettier-ignore
    rows: [
      'WWWWWWWWW',
      'WW  W  WW',
      'W     B W',
      'W SS SSPW',
      'W S W S W',
      'WW  T  WW',
      'WW  TBWWW',
      'WWW   WWW',
      'WWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-48',
    name: 'Defiant Loaf',
    // prettier-ignore
    rows: [
      'WWWWWWWWWWW',
      'WWWW  WWWWW',
      'W     WWWWW',
      'W B W  T WW',
      'W  W   T  W',
      'WW WBBWT  W',
      'WW    WWWWW',
      'W P WWWWWWW',
      'W   WWWWWWW',
      'WWWWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-49',
    name: 'Leash Tangle',
    // prettier-ignore
    rows: [
      'WWWWWWWWW',
      'WWW  WWWW',
      'WWW    WW',
      'WWW  W  W',
      'W  BTPW W',
      'W TBTBT W',
      'WWTBWWBWW',
      'WW     WW',
      'WWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-50',
    name: 'Vacuum Nemesis',
    // prettier-ignore
    rows: [
      'WWWWWWWWW',
      'WWWW  WWW',
      'WWW S WWW',
      'W B   WWW',
      'WP SST  W',
      'WWW  TB W',
      'WWWW  WWW',
      'WWWW  WWW',
      'WWWWWWWWW',
    ],
    knownSolution:
      'URRURURDDDDLLURURUULDLDLDRDRRURRDLLULLUURRDULLDDRUDRDRRULLULLDDRRLDDRUULLUURDURUULDLDDRDRURRDLLULLUURRDULLDDRUDRDRRULLULLDDRUDRDDLUURURRDLULDLLURRLLULLDRRDRRUULLDDRDDRUULLUURDDUURUULDDLDLLURRDDRRULLUURRDULLDDRUDDRDDLUULUULLDRURRRDDRRULDLLDDRU',
  },
  {
    id: 'corgiban-test-51',
    name: 'Potty Break Panic',
    // prettier-ignore
    rows: [
      'WWWWWWWWW',
      'W  W  WWW',
      'W    BWWW',
      'W  WW T W',
      'WW      W',
      'WWT WW WW',
      'WWW WW WW',
      'WW  WTB W',
      'WW BB T W',
      'WW PWWWWW',
      'WWWWWWWWW',
    ],
    knownSolution:
      'LUURUUULUURRURDDULLLDDRRRLLDDDLDDRUUUULUUURRRDDLLDLUULURDDRRRURRDLDDDLDLRURRDLLURUUULLLDLUDRDDLDDRUUUULURRRURDLLLDDDDRRURRDLLURUUUDDDDLLRURUUULLLDDDLDDRUUUULURRLLULUURDDDRDDDDRRURUUULUULLRRDDRRULDLUDRDDDDLLLUUUURRURDDDUULLLDDDDRRRRULUUULLLLULUURDRRURDDRDDDDDLLLUUUURRURDDDUULLLLULURRRLLDDRRRRDDDRDLLLRRUUUULLLLUURRURDDULLLDDRRRLLDDDLDDRURRRUUUULLLDDDLDRRR',
  },
  {
    id: 'corgiban-test-52',
    name: 'Walk Refusal',
    // prettier-ignore
    rows: [
      'WWWWWWWWW',
      'W TTW   W',
      'W TTST WW',
      'WWB  B  W',
      'W   WW  W',
      'WWWWW BWW',
      'W   B B W',
      'WP      W',
      'WWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-53',
    name: 'Belly Up Ambush',
    // prettier-ignore
    rows: [
      'WWWWWWWWWWW',
      'WWWW   WWWW',
      'W  WB  WWWW',
      'W BB      W',
      'WP  WB BW W',
      'WWW W   W W',
      'WW  WWWWW W',
      'WW  TTTTT W',
      'WWWWWWWWWWW',
    ],
    knownSolution:
      'UURDRRRRDDLUULLDDDDRRRRRRUUUULLLUULLDRDRDDLUURRRRDDDDLLLLLLUUUURUURRDDUULLDDRDDRRULURLLLUURRDDLLLDDDDRRRRRRUUUULLLUULLDDLLLDRURDDDLDRRRRRLLLLUUUURUURRDDLLLDLLUURDLDRURDDDLDRRRRLLLUUUURUURDRDLLLDLLUURDLDRURDDDLDRRRLLUUUURRRRDDLURULLLLDLLUURDLDRURDDDLDRRLUUUURRRDDLURULLLDLLUURDLDRURDDDLDR',
  },
  {
    id: 'corgiban-test-54',
    name: 'Nap Interrupted',
    // prettier-ignore
    rows: [
      'WWWWWWWWWWWW',
      'WWWW  W   WW',
      'W  W      WW',
      'W B   WWBWWW',
      'W  WW WW WWW',
      'WW TSSWW   W',
      'WW  SQS  W W',
      'WWW WWWW   W',
      'WWW      WWW',
      'WWWWWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-55',
    name: 'Thunder Phobia',
    // prettier-ignore
    rows: [
      'WWWWWWWWWWWWW',
      'WW  WWWWWWWWW',
      'W B  WWWWWWWW',
      'W  B      WWW',
      'WW  B WW  WWW',
      'WWW  B W    W',
      'WWWW  B WBW W',
      'WWWWW  BWPB W',
      'WWWWWWW W WWW',
      'WWWWWTW W  WW',
      'WWWWWTTT TTWW',
      'WWWWW   WTTWW',
      'WWWWWWWWWWWWW',
    ],
    knownSolution:
      'UULUULLLLULULDRDRDRDRDRDDDUUULULUURRRDDRDDDDDLLLDLURRUUUULULULULULLDRDRDRDRDRLULULULUURRDLRRDLDDRURDRDDDUUULLLUUURRRRDDRDDDDDLLDLLURRRRURDLLLUUUULLDRURDDDUUULLLUUURRRRDDRDDDDDLLDLLURRRRUUUUURRDDLRUULLDDDDDUUUUULUULLLDDLDRURDLDRURDDDUUULULUURRRDDRDDDDDLLLRUUUULULUULULLLDRRURDDUULLDDRRURDDULLDRDRURDLDRURDDDUULULLUUURRRRDDRDDDDDLLUUUULLLUUURDDLDRURDLDRURDDDUUULULUURRRRDDDDDD',
  },
  {
    id: 'corgiban-test-56',
    name: 'Suspicious Squirrel',
    // prettier-ignore
    rows: [
      'WWWWWWWWWWWWW',
      'W   WWWWWWWWW',
      'W B    WW   W',
      'WWBWTT      W',
      'WW WWSWWWW WW',
      'W  WWT P W  W',
      'W  BTT W B  W',
      'W  WWWBWWW  W',
      'WW      WWWWW',
      'WWWWW   WWWWW',
      'WWWWWWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-57',
    name: 'Nap Tax',
    // prettier-ignore
    rows: [
      'WWWWWWWWW',
      'W   TWWWW',
      'W BWT B W',
      'W   WBB W',
      'WT TPT TW',
      'W BBW   W',
      'W B TWB W',
      'WWWWT   W',
      'WWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-58',
    name: 'Nope Nope Nope',
    // prettier-ignore
    rows: [
      'WWWWWWWWWW',
      'WWWWWW   W',
      'WWW   B  W',
      'WWW  WBWWW',
      'W  S T  WW',
      'W S S WPWW',
      'W  S S  WW',
      'WWW S TWWW',
      'WWWW   WWW',
      'WWWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-59',
    name: 'Turbo Waddle',
    // prettier-ignore
    rows: [
      'WWWWWWWWWWWW',
      'WWWWWW   WWW',
      'WWW  T W WWW',
      'WWW BT B B W',
      'WWW WTWW B W',
      'WWWPWTTWB  W',
      'W   WWTW  WW',
      'W B B TW BWW',
      'WW WWWTWW WW',
      'WW        WW',
      'WWWWWW  WWWW',
      'WWWWWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-60',
    name: 'Bone Hoarder',
    // prettier-ignore
    rows: [
      'WWWWWWWWWWWWWW',
      'WWWWW   TTTTWW',
      'WWWW B  WTWTWW',
      'WWWP W WTTTTWW',
      'WW  W  WTTTT W',
      'W BWW BW     W',
      'W    B  WWW WW',
      'W  WB B B  BWW',
      'W WW B B  W WW',
      'W  WW  WWW  WW',
      'WW WW WW    WW',
      'WW  B  W B  WW',
      'WWWW   B BWWWW',
      'WWWWWWWW  WWWW',
      'WWWWWWWWWWWWWW',
    ],
    knownSolution:
      'RURLDLDLDLDDDDRDDRRDRRULUURURUULLUURUULURRRRRLDDDDRRDDDDLDDRUUUUUURULLDLUUUDDDRRDDDDDLLLDRLDDRUULURLDDLLULUURURUULUUUURURRDDDDRRDDDDDDLLURDRUUUUUUUULLUULLDLDDDDRDRRRLLLDLDLDDRDRRRUULDRRRUUUUUURULLLDLURUUULLDLDDDDLDRRRRRLLLLDDLDDRDRRDRUULURRURUUUURULLLRRDDDDDLDDRUUUUUURULLDLUUUDDDRRDDLLLLLUUUUULURRLLDLDLDLDLDDRURRRURDLDRRRRRLLLLDDLDDRDRRRUURRUUUUURULLDLUUDDRRDDLLLLULUUUULLDLDLDLDRRRRURDLDRRRRRLLLLLULLLLDDDRDDRRDRRRRDRUULURRURUUUURULLDLUDRRDDDDLDDRUUUUUURULLRDDDLLLLLDDLULURRRRRRLLLLLDDDDLDRRRRDRUULURRURUUUURULDLUDRDDDDLDDRUUUUUUUDDDLLDLLULLDDRULURRRRRLLLLUUUUULLDLDLDDRRDRRUULDDDDDDLDRRRRDRUULURRURUUUURULDDDDDLDDRUUUUUU',
  },
  {
    id: 'corgiban-test-61',
    name: 'Tail Chasing Pro',
    // prettier-ignore
    rows: [
      'WWWWWWWWWWWWWW',
      'WWWWWW   WWWWW',
      'WWWWWW     WWW',
      'WWW   WTWWB WW',
      'W    B     B W',
      'W  W WWTWW   W',
      'WW W W T WWWWW',
      'W  W TQSTS B W',
      'W BWWW   W   W',
      'W B   WWW  WWW',
      'W   W     WWWW',
      'WWWWWWWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-62',
    name: 'Heckin Bamboozle',
    // prettier-ignore
    rows: [
      'WWWWWWWWWW',
      'W    W TWW',
      'W B  WTTTW',
      'WWWB  STSW',
      'W B WW T W',
      'W   WWW WW',
      'W BB   B W',
      'WW     WPW',
      'WWWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-63',
    name: 'Maximum Floof',
    // prettier-ignore
    rows: [
      'WWWWWWWW',
      'WPW  T W',
      'WTBBWT W',
      'W  B  SW',
      'W WBBT W',
      'WB B  TW',
      'W    TTW',
      'WWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-64',
    name: 'Dig Dig Dig',
    // prettier-ignore
    rows: [
      'WWWWWWWWWWWWW',
      'W   WWWWWWWWW',
      'W B    WW   W',
      'WWBWTTT     W',
      'WW WWBWWWW WW',
      'W  WWTTQ W  W',
      'W  B   W B  W',
      'W  WWWBWWW  W',
      'WWWWW      WW',
      'WWWWW   WWWWW',
      'WWWWWWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-65',
    name: 'Loaf Mode',
    // prettier-ignore
    rows: [
      'WWWWWWWWWWWWWWW',
      'WWWWW    WWWWWW',
      'W   W   P  W  W',
      'W  BTSSSSSSTB W',
      'WWWW    W  W  W',
      'WWWWW   W    WW',
      'WWWWWWWWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-66',
    name: 'Judgmental Stare',
    // prettier-ignore
    rows: [
      'WWWWWWWWWWW',
      'WWWWWWW  WW',
      'WWWW    B W',
      'WWWW W S  W',
      'WW  S S  WW',
      'WW W S W WW',
      'WW  S S  WW',
      'W  S W WWWW',
      'W Q    WWWW',
      'WW  WWWWWWW',
      'WWWWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-67',
    name: 'Full Send',
    // prettier-ignore
    rows: [
      'WWWWWWWWWWWWW',
      'W  B B BTSTTW',
      'W B B B STTTW',
      'W  B B BTSTTW',
      'W B B B STTTW',
      'W  B B BTSTTW',
      'W B B B STTTW',
      'W  B B BTSTTW',
      'W B B B STTTW',
      'W  B B BTSTTW',
      'WPB B B STTTW',
      'WWWWWWWWWWWWW',
    ],
    knownSolution:
      'UUUUUUUUURDRDRDRDRRDRRRLLDRRDDDLUURUULLDRURDLDRUUUULDDLDRURDDLDRLLURUULLURRRLLLURRRLLURRLDDDDDLURUULLDRRUUDLLLLURRRRLLLURRRLLURRRLLURRLLDDDLLLLURRRRLLLURRRRLLLURRRLLDLDLLLURRRRRLLLLURRRRLLLLDLLURRRRRLLLLLLDDRRRRRRDRUDLLLULLLLDDRULURRRRRRLLLDLULLDRRRRRRRLLLLLLLDDDRUULURRRRRRLLLLLDDRUUULDDLDDDDRUUUUUUDDDDDRUUUULURDRULDDRRRRRRLLLLLLDDRUUULURDRUDRRDDRDDLUUUUUDDDDLUULURURDLDRRLLUUUURDDDDLDRRLUUUUULLDDDLDRRURDDLDRURDLDRRULLLLULURRRLDDLLLDLULURRRRRRLLDDRRRLLDRRRLLDRRRLLULULULLLDRRRRLLLDRRRRLLLDRRRRLLLULLULLDRRRRRLLLLDRRRRRLLLLULLLDRRRRRRLUULUUUUUUULDDDDDLDRRRRRRLLLLLUUUUUULDDDDDLDRRRRRRLLLLLUUUUUULDDDDDLDRRRRRR',
  },
  {
    id: 'corgiban-test-68',
    name: 'Absolute Unit',
    // prettier-ignore
    rows: [
      'WWWWWWWWWWWWW',
      'WWWW  WWWWWWW',
      'WWWWB WWWWWWW',
      'WWWW  WWWWWWW',
      'WWWW WWWW  WW',
      'W   TT TT  WW',
      'W  BST STBPWW',
      'W   WB BWB  W',
      'WWWWW   W   W',
      'WWWWWWWWWWWWW',
    ],
  },
  {
    id: 'corgiban-test-69',
    name: 'Boss Level Boi',
    // prettier-ignore
    rows: [
      'WWWWWWWWWWWWWWWWWWW',
      'WTTTTTT    WWWWWWWW',
      'WTTTTTT    W WW   W',
      'WTTWWW B    B     W',
      'WTTT B B W  WWW   W',
      'WTTTWBWWWWW    W  W',
      'WWW    W   WB  WB W',
      'WWW  BB B B  BWW  W',
      'WWW  B   WBWB WWB W',
      'WWWWW WW W    WW  W',
      'WWWW  B B WW WWWWWW',
      'WWWW    B  B  WWWWW',
      'WWWWW   W W   WWWWW',
      'WWWWWWWWWPWWWWWWWWW',
      'WWWWWWWWWWWWWWWWWWW',
    ],
    knownSolution:
      'UULLULRDRRULUULLLUDRRLLULULUULUURRRRDDLLLDLUULURRRRRRURRDDLDLLLLLDLUULURRRRLLLDDDRDRDRDRRULULDUUDDLLUUULUUURRRRRRRDDLDLLLLLDLUULURRURRDRULLLDRRLLLDDDRDDRRULDLUUDDRRUUULLDLUULURRLDDRDDRRRDDRRDDDLDLLUDRRURRLLDLLURURLDLLURUUURULLDLUUDRRUURRRURRRRRRRURDLLLLLLLLDLLURRRRRRRRRLLLLLLUULLDULLDRULLLDRLLDDDRDRRUULLDLUULURDDDRDDRRRRDRDDLLDLUUUURULLDLUUDRRUULLDLUULUURRRDRULLLDRRLLLDDRULURDDRRRDDDLLDRURRDRRDDLLLUUURULLDLUUDRRUURURRLLDLDDLLULUUUURRRRRDULDULLDRRLULLLDRRLLDDDRDRRUURUDLDDLLULUUUURRRRRRRRDDDRDRRDDLLLULLDURRDLLLLLUUULLDLUULURDDRRRDDDLDLUUUDRRUULLDLUUUDDRRRDDDDDDRRRUULURURRDLLLLLLDLUUUDRRUULLLDLUUDRRRRDDDDDDDDRRULULUURRRDDLLDLUUUURULLDLUUDRRUULLDLURRRDDDDDDRRRRDLLLDLUUUUURULLDLUUDRRUULLLDLURRRRDDDRRRRRRRRUULDRDLLLLLLLLLDLUUUDRRUURRRURUULLLLLLLDDDRDLRDRRUULLRRRRRURUULLLLLLLDDDRDDRRRDRRDDDDRRRDRRULLLLLLLDLUUUUURULLDLUUDRRUULLLRRRDDDDRRRDDRDRRRUURUUDDLURULLLLLLLLLDLUUUDRRUULLRRDDDRRRRRRRDDLLUDRRUULLLLLLLLDLUUUDRRRDRRRRRRUURRDLULDRDLLLLLLLLLDLUURRUURRRURUULLLLLDLULDURRRRRRRDDLDLLUULLLRRRDDRRURUULLLLLLRRRRRRDDLURULLLLLRRRRDLLLLRRRRDDLURULLLRDDLDDRDRRRRRRUULUULLLLDLUURULLRRRRDDRRRRRRURRDLLLLLLLLLLRRRRRRRRRRDDLURULLLLLLLLLRRRRRRRRRDDDDLUUURULLLLLLLULLDDLUUDDLURULRRULLRRRRDDLLLDLUUDRRRRRRRRRRRDDDDDDLUUUUURULLLLLLLLLLDLU',
  },
].map(normalizeLevelDefinition);

export const builtinLevelsByCategory: Record<string, LevelDefinition[]> = {
  launch: launchLevels,
};

export const builtinLevels: LevelDefinition[] = launchLevels;
