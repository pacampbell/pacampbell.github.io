// ─────────────────────────────────────────────────────────────────────────────
// Quest Builder  –  quest.js
// ─────────────────────────────────────────────────────────────────────────────

// ── Resource imports ──────────────────────────────────────────────────────────
let npcNames        = {};
let itemNames       = {};
let emNames         = {};
let stageIds        = {};
let stageNames      = {};
let newsImages      = [];
let wildHuntImages  = [];
let emThinkInfo     = {};
let emMontageInfo   = {};
let hmPresetList    = [];
let thinkTableNotes = {};
let montageNotes    = {};
let namedParamList  = [];

try {
    const [n, i, e, s, sn, ni, whi, eti, emi, hpl, ttn, mn, npl] = await Promise.all([
        fetch('./resources/npcNames.json').then(r => r.json()),
        fetch('./resources/itemNames.json').then(r => r.json()),
        fetch('./resources/emNames.json').then(r => r.json()),
        fetch('./resources/stageIds.json').then(r => r.json()),
        fetch('./resources/stageNames.json').then(r => r.json()),
        fetch('./resources/newsImages.json').then(r => r.json()),
        fetch('./resources/wildHuntImages.json').then(r => r.json()),
        fetch('./resources/emThinkInfo.json').then(r => r.json()),
        fetch('./resources/emMontageInfo.json').then(r => r.json()),
        fetch('./resources/hmPresets.json').then(r => r.json()),
        fetch('./resources/thinkTableNotes.json').then(r => r.json()),
        fetch('./resources/montageNotes.json').then(r => r.json()),
        fetch('./resources/namedParams.json').then(r => r.json()),
    ]);
    npcNames        = n;
    itemNames       = i;
    emNames         = e;
    stageIds        = s;
    stageNames      = sn;
    newsImages      = ni;
    wildHuntImages  = whi;
    emThinkInfo     = eti;
    emMontageInfo   = emi;
    hmPresetList    = hpl;
    thinkTableNotes = ttn;
    montageNotes    = mn;
    namedParamList  = npl;
} catch (_) { /* offline / path issues — proceed without lookup */ }

const hmPresetsByEmCode = new Map(hmPresetList.filter(p => p.emCode).map(p => [p.emCode, p]));
const namedParamsById   = new Map(namedParamList.map(p => [p.id, p]));

function newsImagePath(id) {
    return `images/news/news_bannar_${String(id).padStart(3, '0')}_ID.png`;
}
function mainQuestImagePath(questId) {
    return `images/main_quest/mq${String(questId).padStart(4, '0')}_ID.png`;
}
function wildHuntImagePath(bgId) {
    return `images/wildhunt/mh${String(bgId).padStart(4, '0')}_ID.png`;
}
function substoryImagePath(groupId, seqNum) {
    return `images/substory/banner/pq_img_${String(groupId).padStart(3, '0')}_${String(seqNum).padStart(3, '0')}_ID.png`;
}
function substoryPortraitPath(groupId) {
    const grp = SUBSTORY_GROUPS.find(g => g.id === groupId);
    return grp ? `images/substory/portrait/pq_npc_img_${String(grp.npcId).padStart(5, '0')}_ID.png` : null;
}
function questImagePath(q) {
    switch (q?.type) {
        case 'World':    return q.news_image          != null ? newsImagePath(q.news_image) : null;
        case 'Main':     return q.quest_id            != null ? mainQuestImagePath(q.quest_id) : null;
        case 'WildHunt': return q.order_background_id != null ? wildHuntImagePath(q.order_background_id) : null;
        case 'Substory': return q.substory_group_id   != null
            ? substoryImagePath(q.substory_group_id, q.substory_sequence_num ?? 0) : null;
        default: return null;
    }
}

const SUBSTORY_GROUPS = [
    { id: 1, name: 'Carrie', npcId: 580, seqs: [0, 3, 4, 5, 7, 8, 9, 10] },
    { id: 2, name: 'Sonel',  npcId: 582, seqs: [0, 11, 12, 13, 14, 15, 16, 17] },
    { id: 3, name: 'Mephis', npcId: 680, seqs: [0, 18, 19, 20, 21, 22, 23, 24] },
];

// ── Static data ───────────────────────────────────────────────────────────────
const QUEST_TYPES = [
    // Canonical enum names
    'Main', 'Tutorial', 'Substory', 'Limited', 'CycleContents', 'CycleContentsQuest', 'WorldManage',
    // Pseudo aliases
    'World', 'Board', 'ExtremeMission', 'WildHunt',
];

const ANNOUNCE_TYPES = [
    'Accept', 'Clear', 'Failed', 'Update', 'Discovered', 'Caution',
    'Start', 'ExUpdate', 'End', 'StageStart', 'StageClear', 'UrgentUpdate',
    'Unknown0', 'None', 'Checkpoint', 'CheckpointAndUpdate',
];

// [enumName, prettyName] — matches QuestAreaId.cs / QuestAreaIdExtension.PrettyNameMap
const AREA_IDS = [
    ['HidellPlains',            'Hidell Plains'],
    ['BreyaCoast',              'Breya Coast'],
    ['MysreeForest',            'Mysree Forest'],
    ['VoldenMines',             'Volden Mines'],
    ['DoweValley',              'Dowe Valley'],
    ['MysreeGrove',             'Mysree Grove'],
    ['DeenanWoods',             'Deenan Woods'],
    ['BetlandPlains',           'Betland Plains'],
    ['NorthernBetlandPlains',   'Northern Betland Plains'],
    ['ZandoraWastelands',       'Zandora Wastelands'],
    ['EasternZandora',          'Eastern Zandora'],
    ['MergodaRuins',            'Mergoda Ruins'],
    ['BloodbaneIsle',           'Bloodbane Island'],
    ['ElanWaterGrove',          'Elan Water Grove'],
    ['FaranaPlains',            'Farana Plains'],
    ['MorrowForest',            'Morrow Forest'],
    ['KingalCanyon',            'Kingal Canyon'],
    ['RathniteFoothills',       'Rathnite Foothills'],
    ['FeryanaWilderness',       'Feryana Wilderness'],
    ['MegadosysPlateau',        'Megadosys Plateau'],
    ['UrtecaMountains',         'Urteca Mountains'],
    ['MemoryOfMegadosys',       'Memory of Megadosys'],
    ['MemoryOfUrteca',          'Memory of Urteca'],
    ['BitterblackMaze',         'Bitterblack Maze'],
];
const areaIdLabel = v => AREA_IDS.find(([id]) => id === v)?.[1] ?? v;

const FLAG_TYPES   = ['QstLayout', 'MyQst', 'WorldManageLayout', 'WorldManageQuest', 'Lot', 'Sce'];
const FLAG_ACTIONS = ['Set', 'Clear', 'CheckOn', 'CheckOff', 'CheckSetFromFsm', 'None'];

// ── Order condition types ─────────────────────────────────────────────────────
const OC_TYPES = [
    'None0','MinimumLevel','MinimumVocationLevel','Solo','None1','None2',
    'MainQuestCompleted','ClearPersonalQuest','ClearExtremeMission','AreaRank',
    'SoloWithPawns','ArisenTactics','PrepareEquipment','None3','PartnerPawnInParty',
    'None4','ItemRank','PocessesItem','SoloWithPawnCount','ClearWorldQuest',
    'ClearSubstory','MinimumJobLevel',
];
// Param labels; entries with type:'area' render as a select using QUEST_AREA_IDS
const OC_PARAMS = {
    MinimumLevel:         [{ label: 'Level' }],
    MinimumVocationLevel: [{ label: 'Job ID' }, { label: 'Level' }],
    MainQuestCompleted:   [{ label: 'Quest ID' }],
    ClearPersonalQuest:   [{ label: 'Quest ID' }],
    ClearExtremeMission:  [{ label: 'Quest ID' }],
    AreaRank:             [{ label: 'Area', type: 'area' }, { label: 'Rank' }],
    ItemRank:             [{ label: 'Avg Item Rank' }],
    PocessesItem:         [{ label: 'Item ID' }],
    SoloWithPawnCount:    [{ label: '# Allowed Pawns' }],
    ClearWorldQuest:      [{ label: 'Quest ID' }],
    ClearSubstory:        [{ label: 'Substory ID' }],
    MinimumJobLevel:      [{ label: 'Level' }],
};
const QUEST_AREA_IDS = [
    [0,'Unknown'],[1,'Hidell Plains'],[2,'Breya Coast'],[3,'Mysree Forest'],
    [4,'Volden Mines'],[5,'Dowe Valley'],[6,'Mysree Grove'],[7,'Deenan Woods'],
    [8,'Betland Plains'],[9,'Northern Betland Plains'],[10,'Zandora Wastelands'],
    [11,'Eastern Zandora'],[12,'Mergoda Ruins'],[13,'Bloodbane Island'],
    [14,'Elan Water Grove'],[15,'Farana Plains'],[16,'Morrow Forest'],
    [17,'Kingal Canyon'],[18,'Rathnite Foothills'],[19,'Feryana Wilderness'],
    [20,'Megadosys Plateau'],[21,'Urteca Mountains'],[22,'Memory of Megadosys'],
    [23,'Memory of Urteca'],[24,'Bitterblack Maze'],
];
const REWARD_TYPES   = ['exp','wallet','ap','pp','jp','fixed','select','random'];
const WALLET_TYPES   = ['Gold','RiftPoints'];

// ── ContentsRelease / TutorialId enums ────────────────────────────────────────
const CONTENTS_RELEASE_TYPES = [
    'None','PartyPlayers','PawnAndPartyPlay','WorldQuests','GrandMissions','ExtremeMissions',
    'DressEquipment','LestaniaNews','JobTrainingLog','RiftTeleport','DragonForceAugmentation',
    'Craft','Riftstone','QuestBoard','AreaMaster','AreaMastersWorldQuestInfo',
    'FighterJobTraining','HunterJobTraining','PriestJobTraining','ShieldSageJobTraining',
    'SeekerJobTraining','SorcererJobTraining','WarriorJobTraining','ElementArcherJobTraining',
    'AlchemistJobTraining','ChangeVocations','CreateandJoinClans','MainMenu','MyrmidonsPledge',
    'AdventureBroker','MatchingProfile','QuickParty','OrbEnemy','WarSkillAugmentation',
    'FighterWarSkillAugmentation','HunterWarSkillAugmentation','PriestWarSkillAugmentation',
    'ShieldSageWarSkillAugmentation','SeekerWarSkillAugmentation','SorcererWarSkillAugmentation',
    'WarriorWarSkillAugmentation','ElementArcherWarSkillAugmentation','AlchemistWarSkillAugmentation',
    'BloodbaneIsleWorldQuests','ChangeBgmIsland','MyRoom','Baggage',
    'SpiritLancerJobTraining','SpiritLancerWarSkillAugmentation',
    'MorrowForestWorldQuests','ElanWaterGroveWorldQuests','FaranaPlainsWorldQuests',
    'KingalCanyonWorldQuests','PlayPoints','AreaInvestigation','PawnTacticalTraining',
    'FighterVocationEmblem','PriestVocationEmblem','HunterVocationEmblem','ShieldSageVocationEmblem',
    'SeekerVocationEmblem','SorcererVocationEmblem','ElementArcherVocationEmblem',
    'WarriorVocationEmblem','AlchemistVocationEmblem','SpiritLancerVocationEmblem',
    'RathniteFoothillsWorldQuests','FeryanaWildernessWorldQuests','MandragoraBreeding',
    'SpecialSkillAugmentation','YourRoomsTerrace','CooperatorsoftheRoyalFamily',
    'HighScepterJobTraining','MegadosysPlateauWorldQuests','HighScepterVocationEmblem',
    'ChangetoHighScepter','PawnsNewSpecialSkills','HighScepterWarSkillAugmentation',
    'UrtecaMountainsWorldQuests','Unknown85','WildHunt','DismantlingofDragonArms',
    'SynthesisofDragonAbilities','ExtremeMission0','ExtremeMission1','ExtremeMission2',
    'ExtremeMission3','AppraisalExchangeofDragonArmor',
];

const TUTORIAL_ID_TYPES = [
    'None','MainQuests','UsingtheAreaMap','BasicAbilities','ShortcutBar','HazardousLocations',
    'BoardQuest','FightingMonsters','TheWhiteDragonTemple','PriorityQuests','NPCs',
    'UsingtheMinimap','LestaniaNews','WorldQuests','QuestRecommendedLevel','ChatLog',
    'BasicGrowth','Climbing','ObtainingItems','UsingItems',
    'TacticalRoleoftheElementArcher','TacticalRoleoftheFighter','TacticalRoleofthePriest',
    'TacticalRoleoftheHunter','TacticalRoleoftheShieldSage','TacticalRoleoftheSeeker',
    'TacticalRoleoftheWarrior','TacticalRoleoftheSorcerer',
    'BasicTacticsFighter','BasicTacticsPriest','BasicTacticsHunter','BasicTacticsShieldSage',
    'BasicTacticsSeeker','BasicTacticsWarrior','BasicTacticsSorcerer','BasicTacticsElementArcher',
    'BeautyShop','TradingGoods','Equipment','StorageBox','DragonsKeystoneandRiftTeleport',
    'Inn','Bazaar','PartyCreation','ImportantPointsofPartyPlay','AcquiringCombatManuevers',
    'ExtremeMissions','ArisensFurtherGrowthandDragonForceAugmentation','JobRolesRoleinCombat',
    'AutoRun','RetryingQuests','JobMasters','PortcrystalUse','ExploringTheWorld',
    'BloodOrbExchange','AreaMasters','BasicGrowthofaPawn','WhatArePawns',
    'HiringandOrganizingPawns','ResurrectingPawns','CraftRoom','CraftingBasicItems',
    'CustomizingEquipment','Achievements','Clans','ItemLimits','QuestLimits',
    'SuspendResumeGame','WhatAreTheArisen','BattleforGrittenFort','TheCrucibleofDemons',
    'CastingLightIntoDarkness','CustomSkills','JobTrainingLog','Portcrystals','MeansofRecovery',
    'SituationinLestania','StampBonus','StrengtheningEquipmentwithCrests','TreasureLot',
    'BasicTacticsAlchemist','TacticalRoleoftheAlchemist','AdvancedTacticsFighter',
    'HowtoContinueQuests','MyrmidonsPledge','DressEquipment','AdvancedTacticsHunter',
    'AdvancedTacticsPriest','AdvancedTacticsShieldSage','Clinging','LeavingtotheField',
    'RecoveringRevivals','ReturnToTemple','FightingLargeEnemies','UsingTheProgressMarker',
    'AdvancedTacticsSeeker','AdvancedTacticsSorcerer','AdvancedTacticsElementArcher',
    'AdvancedTacticsWarrior','AdvancedTacticsAlchemist','AncientWarrior','TheLostOrder',
    'TheDazzlingGold','PawnReactionSettings','PawnCommands','RiftTeleportwithParty',
    'Withdrawing','PawnRescue','UseofFreeMarkers','PurchasingWorldQuestInformation',
    'ReapRewardsfortheWorldQuest','MonsterWarningMessage','BloodOrbEnemies',
    'CoordinatedActions','AreaMastersSupportGoods','ChallengeRanking','AreaRankAndLevelingUp',
    'TutorialGuide','CraftingLevelTest','AreaQuests','ChangingVocations','PartyRewards',
    'AllocatingCraftPoints','DealingwithWeakness','RespondingtoPartyInvites',
    'NotesonMainQuestBossMonsters','LestaniaPrologue','LestaniaSectionII','AppraisalExchange',
    'LestaniaSectionIII','ArisensRoom','AppraisingJewelry','InheritanceSkillsOfBattleTechniques',
    'AboutInfectedSmallEnemies','AboutInfectedPlants','BasicTacticsSpiritLancer',
    'AdvancedTacticsSpiritLancer','TacticalRoleoftheSpiritLancer','AboutInfectedLargeEnemies',
    'BloodbaneIslesFeastofMadness','TheDemonofDarknessAwakens','PhantasmicGreatDragon',
    'AgentofCorruption','TheInfectionIntroduction','TheInfectionSectionII','NewAreaUnlock',
    'WhatIsAverageItemRankIR','PawnExpeditions','SubPortcrystals','CustomSkillPaletteSwitching',
    'AboutFurniture','AreaRankCapUnlock','FightingLargeEnemiesBreakIcon',
    'FightingLargeEnemiesSpecialConditions','TheDeathlyBattleoftheAncientTemple',
    'TheDragonAwakened','PlayPoints','ClanLevelsandClanHalls','AnExplorersJourney',
    'RequestsfromPawn','EarthsFury','OnsetofDarkness','TheInfectionSectionIII',
    'TheInfectionSectionIV','MadInvadersTentacles','Training','ClanDungeons','PlayPointShop',
    'AreaVisualSurvey','AdvancedTacticsAlchemistII','RecurrenceofDarkness','OnlineShop',
    'MailConfirmation','DespairoftheCookCarrie','NPCEscortsFoodGauge',
    'RestorationoftheGreatDiningHall','FoodTransportationtoLocations','DominionPointShop',
    'DacreimFortressRecaptureBattle','EnfiladeofDespairandTragedyRestrictedStage','BattleGauge',
    'SkillInheritanceOfUltimateSkills','CustomSkillEXStrengthSwitchingTechniques',
    'PawnTacticsTraining','DemonGatheringSpot','LimitedTimeReleaseSpot','TheEpitaphRoad',
    'HighOrbs','AboutCustomMadeWorkshop','JifuleFortressCaptureBattle',
    'TheInvitingEyeRestrictedStage','TheLandofDespairPrologue','TheLandofDespairSectionII',
    'MandragoraGardening','BonusDungeons','AchievementsRoyalFamilyRestoration','EmblemStones',
    'ClanHallExclusiveFurniture','AboutArmoredBattlesSmallEnemies','AboutArmoredBattlesLargeEnemies',
    'PhotoMode','AboutDwarfOrcs','InfiltrationOfEnemyTerritory','GuideSonel',
    'APlaceWithTightSecurity','CrawlingAround','RescuetheGeniusCommanderSonel','TentTactics',
    'OptionsAfterASuccessfulCraft','CaptureOfTheGate','WarMissions','HowtoObtainanEmblemStone',
    'AboutArmoredBattlesAdditionalNotes','LimitBreakingArms','UltimateSynthesisofArms',
    'SpecialQuestBoard','BasicTacticsHighScepter','AdvancedTacticsHighScepter',
    'TacticalRoleoftheHighScepter','ArtilleryThatPlayersCanOperate','TheLandofDespairSectionIII',
    'PawnSpecialSkills','VisitPartyMembersRoom','HazardousLocationsAdditionalNotes',
    'TheDoorSealedbytheRoyalFamily','TheEpitaphRoadOrdeals','WhatIstheBitterblackMaze',
    'BitterblackEquipmentEffectSeal','RareItemAppraisal','BitterblackMazeEquipment',
    'BitterblackItemTakeaway','PlayBitterblackMazeAgain','AdventureGuide',
    'TheDeathlyBattleoftheForestofMist','FlamesofDarknessRestrictedStage',
    'WallsThatBreakunderCertainConditions','PawnsNewBehavior',
    'ExposetheDarkSidetotheOneOperatingbehindtheScenesMephis','WhatIsInterrogation',
    'AboutUndercover','AboutIntelligenceAssessment','AboutIntelligenceAssessmentAdditionalNotes',
    'AboutTheSecretMissionInMegado','AboutFriends','ResurrectionOfTheFlameOfDespair',
    'TheEpitaphRoadDivineProtectionofHeroicSpirits','AboutFlameEnemies',
    'TheLandofDespairSectionIV','ReliefByFriendlyAttack','BitterblackMazeAbyss',
    'DarkDragonCrystalDestruction','MissionsinDungeons','ChainRewards','HighOrbShop',
    'DragonAbilities','DragonAbilitiesSpiritDragon','DragonAbilitiesFireDragon',
    'DragonAbilitiesWhiteDragon','DecisiveBattleWithTheBlackDragon','WildHuntBasics',
    'WildHuntAdditionalNotes','AcreSelundWarChronicles','EnhancementofDragonAbilities',
    'SynthesisofDragonAbilities','DragonEquipmentDecomposition','RewardMissions',
    'faceTheVortexOfDestruction','TheLandofDespairSectionV',
];

// ── Check / Result command parameter schemas ──────────────────────────────────
// params: named labels for Param1..Param4 (omit trailing unused)
const p = (a,b,c,d) => [a,b,c,d].filter(Boolean).map(n => ({ name: n }));
const CMD_PARAMS = {
    // ── Check commands ──────────────────────────────────────────────────────
    TalkNpc:                          p('StageNo','NpcId'),
    DieEnemy:                         p('StageNo','GroupNo','SetNo'),
    SceHitIn:                         p('StageNo','SceNo'),
    HaveItem:                         p('ItemId','ItemNum'),
    DeliverItem:                      p('ItemId','ItemNum','NpcId','MsgNo'),
    EmDieLight:                       p('EnemyGroupId','EnemyLv','EnemyNum'),
    QstFlagOn:                        p('QuestId','FlagNo'),
    QstFlagOff:                       p('QuestId','FlagNo'),
    MyQstFlagOn:                      p('FlagNo'),
    MyQstFlagOff:                     p('FlagNo'),
    Padding00:                        p(),
    Padding01:                        p(),
    Padding02:                        p(),
    StageNo:                          p('StageNo'),
    EventEnd:                         p('StageNo','EventNo'),
    Prt:                              p('StageNo','X','Y','Z'),
    Clearcount:                       p('MinCount','MaxCount'),
    SceFlagOn:                        p('FlagNo'),
    SceFlagOff:                       p('FlagNo'),
    TouchActToNpc:                    p('StageNo','NpcId'),
    OrderDecide:                      p('NpcId'),
    IsEndCycle:                       p(),
    IsInterruptCycle:                 p(),
    IsFailedCycle:                    p(),
    IsEndResult:                      p(),
    NpcTalkAndOrderUi:                p('StageNo','NpcId','NoOrderGroupSerial'),
    NpcTouchAndOrderUi:               p('StageNo','NpcId','NoOrderGroupSerial'),
    StageNoNotEq:                     p('StageNo'),
    Warlevel:                         p('WarLevel'),
    TalkNpcWithoutMarker:             p('StageNo','NpcId'),
    HaveMoney:                        p('Gold','Type'),
    SetQuestClearNum:                 p('ClearNum','AreaId'),
    MakeCraft:                        p(),
    PlayEmotion:                      p(),
    IsEndTimer:                       p('TimerNo'),
    IsEnemyFound:                     p('StageNo','GroupNo','SetNo'),
    RandomEq:                         p('RandomNo','Value'),
    RandomNotEq:                      p('RandomNo','Value'),
    RandomLess:                       p('RandomNo','Value'),
    RandomNotGreater:                 p('RandomNo','Value'),
    RandomGreater:                    p('RandomNo','Value'),
    RandomNotLess:                    p('RandomNo','Value'),
    Clearcount02:                     p('Div','Value'),
    IngameTimeRangeEq:                p('MinTime','MaxTime'),
    IngameTimeRangeNotEq:             p('MinTime','MaxTime'),
    PlHp:                             p('HpRate','Type'),
    EmHpNotLess:                      p('StageNo','GroupNo','SetNo','HpRate'),
    EmHpLess:                         p('StageNo','GroupNo','SetNo','HpRate'),
    WeatherEq:                        p('WeatherId'),
    WeatherNotEq:                     p('WeatherId'),
    PlJobEq:                          p('JobId'),
    PlJobNotEq:                       p('JobId'),
    PlSexEq:                          p('Sex'),
    PlSexNotEq:                       p('Sex'),
    SceHitOut:                        p('StageNo','SceNo'),
    WaitOrder:                        p(),
    OmSetTouch:                       p('StageNo','GroupNo','SetNo'),
    OmReleaseTouch:                   p('StageNo','GroupNo','SetNo'),
    JobLevelNotLess:                  p('CheckType','Level'),
    JobLevelLess:                     p('CheckType','Level'),
    MyQstFlagOnFromFsm:               p('FlagNo'),
    SceHitInWithoutMarker:            p('StageNo','SceNo'),
    SceHitOutWithoutMarker:           p('StageNo','SceNo'),
    KeyItemPoint:                     p('Idx','Num'),
    IsNotEndTimer:                    p('TimerNo'),
    IsMainQuestClear:                 p('QuestId'),
    DogmaOrb:                         p(),
    IsEnemyFoundForOrder:             p('StageNo','GroupNo','SetNo'),
    IsTutorialFlagOn:                 p('FlagNo'),
    QuestOmSetTouch:                  p('StageNo','GroupNo','SetNo'),
    QuestOmReleaseTouch:              p('StageNo','GroupNo','SetNo'),
    NewTalkNpc:                       p('StageNo','GroupNo','SetNo','QuestId'),
    NewTalkNpcWithoutMarker:          p('StageNo','GroupNo','SetNo','QuestId'),
    IsTutorialQuestClear:             p('QuestId'),
    IsMainQuestOrder:                 p('QuestId'),
    IsTutorialQuestOrder:             p('QuestId'),
    IsTouchPawnDungeonOm:             p('StageNo','GroupNo','SetNo'),
    IsOpenDoorOmQuestSet:             p('StageNo','GroupNo','SetNo','QuestId'),
    EmDieForRandomDungeon:            p('StageNo','EnemyId','EnemyNum'),
    NpcHpNotLess:                     p('StageNo','GroupNo','SetNo','HpRate'),
    NpcHpLess:                        p('StageNo','GroupNo','SetNo','HpRate'),
    IsEnemyFoundWithoutMarker:        p('StageNo','GroupNo','SetNo'),
    IsEventBoardAccepted:             p(),
    WorldManageQuestFlagOn:           p('FlagNo','QuestId'),
    WorldManageQuestFlagOff:          p('FlagNo','QuestId'),
    TouchEventBoard:                  p(),
    OpenEntryRaidBoss:                p(),
    OepnEntryFortDefense:             p(),
    DiePlayer:                        p(),
    PartyNumNotLessWtihoutPawn:       p('PartyMemberNum'),
    PartyNumNotLessWithPawn:          p('PartyMemberNum'),
    LostMainPawn:                     p(),
    SpTalkNpc:                        p(),
    OepnJobMaster:                    p(),
    TouchRimStone:                    p(),
    GetAchievement:                   p(),
    DummyNotProgress:                 p(),
    DieRaidBoss:                      p(),
    CycleTimerZero:                   p(),
    CycleTimer:                       p('TimeSec'),
    QuestNpcTalkAndOrderUi:           p('StageNo','GroupNo','SetNo','QuestId'),
    QuestNpcTouchAndOrderUi:          p('StageNo','GroupNo','SetNo','QuestId'),
    IsFoundRaidBoss:                  p('StageNo','GroupNo','SetNo','EnemyId'),
    QuestOmSetTouchWithoutMarker:     p('StageNo','GroupNo','SetNo'),
    QuestOmReleaseTouchWithoutMarker: p('StageNo','GroupNo','SetNo'),
    TutorialTalkNpc:                  p('StageNo','NpcId'),
    IsLogin:                          p(),
    IsPlayEndFirstSeasonEndCredit:    p(),
    IsKilledTargetEnemySetGroup:      p('FlagNo'),
    IsKilledTargetEmSetGrpNoMarker:   p('FlagNo'),
    IsLeftCycleTimer:                 p('TimeSec'),
    OmEndText:                        p('StageNo','GroupNo','SetNo'),
    QuestOmEndText:                   p('StageNo','GroupNo','SetNo'),
    OpenAreaMaster:                   p('AreaId'),
    HaveItemAllBag:                   p('ItemId','ItemNum'),
    OpenNewspaper:                    p(),
    OpenQuestBoard:                   p(),
    StageNoWithoutMarker:             p('StageNo'),
    TalkQuestNpcUnitMarker:           p('StageNo','GroupNo','SetNo','QuestId'),
    TouchQuestNpcUnitMarker:          p('StageNo','GroupNo','SetNo','QuestId'),
    IsExistSecondPawn:                p(),
    IsOrderJobTutorialQuest:          p(),
    IsOpenWarehouse:                  p(),
    IsMyquestLayoutFlagOn:            p('FlagNo'),
    IsMyquestLayoutFlagOff:           p('FlagNo'),
    IsOpenWarehouseReward:            p(),
    IsOrderLightQuest:                p(),
    IsOrderWorldQuest:                p(),
    IsLostMainPawn:                   p(),
    IsFullOrderQuest:                 p(),
    IsBadStatus:                      p(),
    CheckAreaRank:                    p('AreaId','AreaRank'),
    Padding133:                       p(),
    EnablePartyWarp:                  p(),
    IsHugeble:                        p(),
    IsDownEnemy:                      p(),
    OpenAreaMasterSupplies:           p(),
    OpenEntryBoard:                   p(),
    NoticeInterruptContents:          p(),
    OpenRetrySelect:                  p(),
    IsPlWeakening:                    p(),
    NoticePartyInvite:                p(),
    IsKilledAreaBoss:                 p(),
    IsPartyReward:                    p(),
    IsFullBag:                        p(),
    OpenCraftExam:                    p(),
    LevelUpCraft:                     p(),
    IsClearLightQuest:                p(),
    OpenJobMasterReward:              p(),
    TouchActQuestNpc:                 p('StageNo','GroupNo','SetNo','QuestId'),
    IsLeaderAndJoinPawn:              p('PawnNum'),
    IsAcceptLightQuest:               p(),
    IsReleaseWarpPoint:               p(),
    IsSetPlayerSkill:                 p(),
    IsOrderMyQuest:                   p(),
    IsNotOrderMyQuest:                p(),
    HasMypawn:                        p(),
    IsFavoriteWarpPoint:              p('WarpPointId'),
    Craft:                            p(),
    IsKilledTargetEnemySetGroupGmMain:p('FlagNo'),
    IsKilledTargetEnemySetGroupGmSub: p('FlagNo'),
    HasUsedKey:                       p('StageNo','GroupNo','SetNo','QuestId'),
    IsCycleFlagOffPeriod:             p(),
    IsEnemyFoundGmMain:               p('StageNo','GroupNo','SetNo'),
    IsEnemyFoundGmSub:                p('StageNo','GroupNo','SetNo'),
    IsLoginBugFixedOnly:              p(),
    IsSearchClan:                     p(),
    IsOpenAreaListUi:                 p(),
    IsReleaseWarpPointAnyone:         p('WarpPointId'),
    DevidePlayer:                     p(),
    NowPhase:                         p('PhaseId'),
    IsReleasePortal:                  p(),
    IsGetAppraiseItem:                p(),
    IsSetPartnerPawn:                 p(),
    IsPresentPartnerPawn:             p(),
    IsReleaseMyRoom:                  p(),
    IsExistDividePlayer:              p(),
    NotDividePlayer:                  p(),
    IsGatherPartyInStage:             p('StageNo'),
    IsFinishedEnemyDivideAction:      p(),
    IsOpenDoorOmQuestSetNoMarker:     p('StageNo','GroupNo','SetNo','QuestId'),
    IsFinishedEventOrderNum:          p('StageNo','EventNo'),
    IsPresentPartnerPawnNoMarker:     p(),
    IsOmBrokenLayout:                 p('StageNo','GroupNo','SetNo'),
    IsOmBrokenQuest:                  p('StageNo','GroupNo','SetNo'),
    IsHoldingPeriodCycleContents:     p(),
    IsNotHoldingPeriodCycleContents:  p(),
    IsResetInstanceArea:              p(),
    CheckMoonAge:                     p('MoonAgeStart','MoonAgeEnd'),
    IsOrderPawnQuest:                 p('OrderGroupSerial','NoOrderGroupSerial'),
    IsTakePictures:                   p(),
    IsStageForMainQuest:              p('StageNo'),
    IsReleasePawnExpedition:          p(),
    OpenPpMode:                       p(),
    PpNotLess:                        p('Point'),
    OpenPpShop:                       p(),
    TouchClanBoard:                   p(),
    IsOneOffGather:                   p(),
    IsOmBrokenLayoutNoMarker:         p('StageNo','GroupNo','SetNo'),
    IsOmBrokenQuestNoMarker:          p('StageNo','GroupNo','SetNo'),
    KeyItemPointEq:                   p('Idx','Num'),
    IsEmotion:                        p('ActNo'),
    IsEquipColor:                     p('Color'),
    IsEquip:                          p('ItemId'),
    IsTakePicturesNpc:                p('StageNo','NpcId01','NpcId02','NpcId03'),
    SayMessage:                       p(),
    IsTakePicturesWithoutPawn:        p('StageNo','X','Y','Z'),
    IsLinkageEnemyFlag:               p('StageNo','GroupNo','SetNo','FlagNo'),
    IsLinkageEnemyFlagOff:            p('StageNo','GroupNo','SetNo','FlagNo'),
    IsReleaseSecretRoom:              p(),
    // ── New check commands (211–256) ────────────────────────────────────────
    IsSubstoryStateBit18:             p(),
    StoreLinkageEnemyFlagGlobal:      p(),
    SetNpcOrderFlagAndCheckBit18:     p('StageNo','NpcId','NpcLookupId','StoreVal'),
    TalkNpcChoice:                    p('StageNo','NpcId','Choice'),
    SubstoryEnemyHpNotLess:           p('SubstoryId','HpRatePercent'),
    SubstoryEnemyHpLess:              p('SubstoryId','HpRatePercent'),
    SubstoryAvgEnemyHpNotLess:        p('Param1','HpRatePercent'),
    SubstoryAvgEnemyHpLess:           p('Param1','HpRatePercent'),
    IsOmBehaviorState:                p('StageNo','GroupNo','SetNo','BehaviorState'),
    IsPlayerSpecificLayoutFlag:       p('PlayerId','FlagId','ExpectedValue'),
    IsQuestEnemyAlive:                p('StageNo','GroupNo','SetNo'),
    IsQuestEnemyAlive2:               p('StageNo','GroupNo','SetNo'),
    IsQuestOrAreaEnemyAlive:          p('StageNo','GroupNo','SetNo'),
    IsQuestOrAreaEnemyAlive2:         p('StageNo','GroupNo','SetNo'),
    IsRewardPointNotLess:             p('PlayerId','RewardId','ExpectedValue'),
    OmSetTouchRadius:                 p('StageNo','GroupNo','SetNo'),
    OmReleaseTouchRadius:             p('StageNo','GroupNo','SetNo'),
    QuestTalkNpcRadius:               p('StageNo','GroupNo','SetNo'),
    IsOmBrokenInCurrentPhase:         p('StageNo','GroupNo','SetNo'),
    IsEnemyFoundRadius:               p('StageNo','GroupNo','SetNo','MarkerFlag'),
    IsEnemyFoundForOrderRadius:       p('StageNo','GroupNo','SetNo'),
    IsPawnAvailable:                  p('PawnId'),
    IsSubstoryStateBit19:             p(),
    IsPartyMemberHasItem:             p('ItemListIdx'),
    IsSubstoryStateBit20:             p(),
    IsSubstoryStateBit21:             p(),
    IsSubstoryStateBit22:             p(),
    IsSubstoryStateBit23:             p(),
    IsFsmNpcTalkComplete:             p('NpcId'),
    IsSubstoryIngameHourInRange:      p('MinHour','MaxHour'),
    IsKilledTargetEnemySetGroupMode15:         p('FlagNo'),
    IsKilledTargetEnemySetGroupMode15NoMarker: p('FlagNo'),
    IsContentsTimerBElapsed:          p('TimerNo'),
    IsQuestClearCountNotLess:         p(),
    IsContentsModeTimerNotLess:       p('TimeSec'),
    IsTriggerFlagSetAndClear:         p(),
    IsKillGroupCompleteInRadius:      p('FlagNo'),
    IsContentsTimerAZero:             p('TimerNo'),
    IsWildHuntTargetEnemyKilled:      p('ZoneLinkageId','Param2','Param3','MarkerFlag'),
    IsContentsModeStateFlag:          p(),
    Padding254:                       p(),
    IsQuestEnemyHpNotGreater:         p('StageNo','GroupNo','SetNo','HpLostPct'),
    IsAreaLinkageQuestFlagOn:         p('FlagKey'),
    // ── Result commands ─────────────────────────────────────────────────────
    LotOn:                            p('StageNo','LotNo'),
    LotOff:                           p('StageNo','LotNo'),
    HandItem:                         p('ItemId','ItemNum'),
    SetAnnounce:                      p('AnnounceType','AnnounceSubtype'),
    UpdateAnnounce:                   p('AnnounceType'),
    ChangeMessage:                    p(),
    GlobalFlagOn:                     p(),
    QstTalkChg:                       p('NpcId','MsgNo'),
    QstTalkDel:                       p('NpcId'),
    StageJump:                        p('StageNo','StartPos'),
    EventExec:                        p('StageNo','EventNo','JumpStageNo','JumpStartPosNo'),
    CallMessage:                      p(),
    QstLayoutFlagOn:                  p('FlagNo'),
    QstLayoutFlagOff:                 p('FlagNo'),
    QstSceFlagOn:                     p(),
    QstDogmaOrb:                      p('OrbNum'),
    GotoMainPwanEdit:                 p(),
    AddFsmNpcList:                    p('NpcId'),
    EndCycle:                         p(),
    AddCycleTimer:                    p('Sec'),
    AddMarkerAtItem:                  p('StageNo','X','Y','Z'),
    AddMarkerAtDest:                  p('StageNo','X','Y','Z'),
    AddResultPoint:                   p('TableIndex'),
    PushImteToPlBag:                  p('ItemId','ItemNum'),
    StartTimer:                       p('TimerNo','Sec'),
    SetRandom:                        p('RandomNo','MinValue','MaxValue','ResultValue'),
    ResetRandom:                      p('RandomNo'),
    BgmRequest:                       p('Type','BgmId'),
    BgmStop:                          p(),
    SetWaypoint:                      p('NpcId','WaypointNo0','WaypointNo1','WaypointNo2'),
    ForceTalkQuest:                   p('NpcId','GroupSerial'),
    TutorialDialog:                   p('GuideNo'),
    AddKeyItemPoint:                  p('KeyItemIdx','PointNum'),
    DontSaveProcess:                  p(),
    InterruptCycleContents:           p(),
    QuestEvaluationPoint:             p('Point'),
    CheckOrderCondition:              p(),
    WorldManageLayoutFlagOn:          p('FlagNo','QuestId'),
    WorldManageLayoutFlagOff:         p('FlagNo','QuestId'),
    PlayEndingForFirstSeason:         p(),
    AddCyclePurpose:                  p('AnnounceNo','Type'),
    RemoveCyclePurpose:               p('AnnounceNo'),
    UpdateAnnounceDirect:             p('AnnounceNo','Type'),
    SetCheckPoint:                    p(),
    ReturnCheckPoint:                 p('ProcessNo'),
    CallGeneralAnnounce:              p('Type','MsgNo'),
    // Also used in both (dual-purpose)
    ExeEventAfterStageJump:           p('StageNo','EventNo','StartPos'),
    ExeEventAfterStageJumpContinue:   p('StageNo','EventNo','StartPos'),
    DecideDivideArea:                 p('StageNo','StartPosNo'),
    MyQstFlagOnFromResult:            p('FlagNo'),
    MyQstFlagOffFromResult:           p('FlagNo'),
    TutorialEnemyInvincibleOff:       p(),
    SetDiePlayerReturnPos:            p('StageNo','StartPos','OutSceNo'),
    ReturnCheckPointEx:               p('ProcessNo'),
    ResetCheckPoint:                  p(),
    ResetDiePlayerReturnPos:          p('StageNo','StartPos'),
    SetBarricade:                     p(),
    ResetBarricade:                   p(),
    TutorialEnemyInvincibleOn:        p(),
    ResetTutorialFlag:                p(),
    StartContentsTimer:               p(),
    PlayCameraEvent:                  p('StageNo','EventNo'),
    EndEndQuest:                      p(),
    ReturnAnnounce:                   p(),
    AddEndContentsPurpose:            p('AnnounceNo','Type'),
    RemoveEndContentsPurpose:         p('AnnounceNo'),
    StopCycleTimer:                   p(),
    RestartCycleTimer:                p(),
    AddAreaPoint:                     p('AreaId','AddPoint'),
    LayoutFlagRandomOn:               p('FlagNo1','FlagNo2','FlagNo3','ResultNo'),
    SetDeliverInfo:                   p('StageNo','NpcId','GroupSerial'),
    SetDeliverInfoQuest:              p('StageNo','GroupNo','SetNo','GroupSerial'),
    BgmRequestFix:                    p('Type','BgmId'),
    EventExecCont:                    p('StageNo','EventNo','JumpStageNo','JumpStartPosNo'),
    PlPadOff:                         p(),
    PlPadOn:                          p(),
    EnableGetSetQuestList:            p(),
    StartMissionAnnounce:             p(),
    StageAnnounce:                    p('Type','Num'),
    ReleaseAnnounce:                  p('Id'),
    ButtonGuideFlagOn:                p('ButtonGuideNo'),
    ButtonGuideFlagOff:               p('ButtonGuideNo'),
    AreaJumpFadeContinue:             p(),
    PlayMessage:                      p('GroupNo','WaitTime'),
    StopMessage:                      p(),
    ShiftPhase:                       p('PhaseId'),
    ReleaseMyRoom:                    p(),
    DivideSuccess:                    p(),
    DivideFailed:                     p(),
    SetProgressBonus:                 p('RewardRank'),
    RefreshOmKeyDisp:                 p(),
    SwitchPawnQuestTalk:              p('Type'),
    LinkageEnemyFlagOn:               p('StageNo','GroupNo','SetNo','FlagId'),
    LinkageEnemyFlagOff:              p('StageNo','GroupNo','SetNo','FlagId'),
    // ── New result commands (99–134) ────────────────────────────────────────
    SubstoryProgress:                 p('Delta'),
    AddSubstoryProgress:              p('SubstoryId','ProgressDelta'),
    TriggerSubstoryEvent:             p(),
    EnableSubstoryUIElement:          p(),
    DisableSubstoryUIElement:         p(),
    QstTalkChgFsm:                    p('NpcId','MsgNo'),
    SetSubstoryEnemyInvincible:       p('EnemyGroupFlag','Invincible'),
    Padding106:                       p(),
    AddFsmTalkNpc:                    p('NpcId'),
    SetSubstoryEnemyGroupFlag:        p('GroupId','FlagValue'),
    EnableSubstoryElementB:           p(),
    DisableSubstoryElementB:          p(),
    SetWorldManageBarrierOn:          p(),
    SetWorldManageBarrierOff:         p(),
    SetFsmNpcSchedule:                p('Param1','Param2','Param3','ScheduleId'),
    SetQuestEnemyLevel:               p('StageNo','GroupNo','SetNo','Level'),
    SetQuestEnemyLevelEx:             p('StageNo','GroupNo','SetNo','Level'),
    SetQuestEnemyTierUp:              p('StageNo','GroupNo','SetNo','Tier'),
    SetQuestEnemyTierUpEx:            p('StageNo','GroupNo','SetNo','Tier'),
    SetQuestOmMontageFix:             p('StageNo','GroupNo','SetNo','PoseId'),
    SetQuestOmMontageFixEx:           p('StageNo','GroupNo','SetNo','PoseId'),
    Padding120:                       p(),
    SetQuestLayoutEnemyLevel:         p('StageNo','GroupNo','SetNo','Level'),
    Padding122:                       p(),
    Padding123:                       p(),
    RemoveFsmNpcFromSchedule:         p(),
    Padding125:                       p(),
    SetEnemyExpeditionState:          p('Mode'),
    Padding127:                       p(),
    TriggerSubstoryEndSequence:       p(),
    Padding129:                       p(),
    CheckSubstoryCondition:           p(),
    Padding131:                       p(),
    Padding132:                       p(),
    SetPawnExpeditionFlag:            p('Mode'),
    SetQuestLayoutEnemyBodyPose:      p('StageNo','GroupNo','SetNo','PoseId'),
};

const CHECK_CMD_TYPES = [
    'TalkNpc','DieEnemy','SceHitIn','HaveItem','DeliverItem','EmDieLight',
    'QstFlagOn','QstFlagOff','MyQstFlagOn','MyQstFlagOff',
    'Padding00','Padding01','Padding02',
    'StageNo','EventEnd','Prt','Clearcount','SceFlagOn','SceFlagOff',
    'TouchActToNpc','OrderDecide','IsEndCycle','IsInterruptCycle','IsFailedCycle','IsEndResult',
    'NpcTalkAndOrderUi','NpcTouchAndOrderUi','StageNoNotEq','Warlevel','TalkNpcWithoutMarker',
    'HaveMoney','SetQuestClearNum','MakeCraft','PlayEmotion','IsEndTimer','IsEnemyFound',
    'RandomEq','RandomNotEq','RandomLess','RandomNotGreater','RandomGreater','RandomNotLess',
    'Clearcount02','IngameTimeRangeEq','IngameTimeRangeNotEq','PlHp','EmHpNotLess','EmHpLess',
    'WeatherEq','WeatherNotEq','PlJobEq','PlJobNotEq','PlSexEq','PlSexNotEq',
    'SceHitOut','WaitOrder','OmSetTouch','OmReleaseTouch','JobLevelNotLess','JobLevelLess',
    'MyQstFlagOnFromFsm','SceHitInWithoutMarker','SceHitOutWithoutMarker','KeyItemPoint',
    'IsNotEndTimer','IsMainQuestClear','DogmaOrb','IsEnemyFoundForOrder','IsTutorialFlagOn',
    'QuestOmSetTouch','QuestOmReleaseTouch','NewTalkNpc','NewTalkNpcWithoutMarker',
    'IsTutorialQuestClear','IsMainQuestOrder','IsTutorialQuestOrder','IsTouchPawnDungeonOm',
    'IsOpenDoorOmQuestSet','EmDieForRandomDungeon','NpcHpNotLess','NpcHpLess',
    'IsEnemyFoundWithoutMarker','IsEventBoardAccepted','WorldManageQuestFlagOn','WorldManageQuestFlagOff',
    'TouchEventBoard','OpenEntryRaidBoss','OepnEntryFortDefense','DiePlayer',
    'PartyNumNotLessWtihoutPawn','PartyNumNotLessWithPawn','LostMainPawn','SpTalkNpc',
    'OepnJobMaster','TouchRimStone','GetAchievement','DummyNotProgress','DieRaidBoss',
    'CycleTimerZero','CycleTimer','QuestNpcTalkAndOrderUi','QuestNpcTouchAndOrderUi',
    'IsFoundRaidBoss','QuestOmSetTouchWithoutMarker','QuestOmReleaseTouchWithoutMarker',
    'TutorialTalkNpc','IsLogin','IsPlayEndFirstSeasonEndCredit','IsKilledTargetEnemySetGroup',
    'IsKilledTargetEmSetGrpNoMarker','IsLeftCycleTimer','OmEndText','QuestOmEndText',
    'OpenAreaMaster','HaveItemAllBag','OpenNewspaper','OpenQuestBoard','StageNoWithoutMarker',
    'TalkQuestNpcUnitMarker','TouchQuestNpcUnitMarker','IsExistSecondPawn',
    'IsOrderJobTutorialQuest','IsOpenWarehouse','IsMyquestLayoutFlagOn','IsMyquestLayoutFlagOff',
    'IsOpenWarehouseReward','IsOrderLightQuest','IsOrderWorldQuest','IsLostMainPawn',
    'IsFullOrderQuest','IsBadStatus','CheckAreaRank','Padding133','EnablePartyWarp',
    'IsHugeble','IsDownEnemy','OpenAreaMasterSupplies','OpenEntryBoard','NoticeInterruptContents',
    'OpenRetrySelect','IsPlWeakening','NoticePartyInvite','IsKilledAreaBoss','IsPartyReward',
    'IsFullBag','OpenCraftExam','LevelUpCraft','IsClearLightQuest','OpenJobMasterReward',
    'TouchActQuestNpc','IsLeaderAndJoinPawn','IsAcceptLightQuest','IsReleaseWarpPoint',
    'IsSetPlayerSkill','IsOrderMyQuest','IsNotOrderMyQuest','HasMypawn','IsFavoriteWarpPoint',
    'Craft','IsKilledTargetEnemySetGroupGmMain','IsKilledTargetEnemySetGroupGmSub','HasUsedKey',
    'IsCycleFlagOffPeriod','IsEnemyFoundGmMain','IsEnemyFoundGmSub','IsLoginBugFixedOnly',
    'IsSearchClan','IsOpenAreaListUi','IsReleaseWarpPointAnyone','DevidePlayer','NowPhase',
    'IsReleasePortal','IsGetAppraiseItem','IsSetPartnerPawn','IsPresentPartnerPawn',
    'IsReleaseMyRoom','IsExistDividePlayer','NotDividePlayer','IsGatherPartyInStage',
    'IsFinishedEnemyDivideAction','IsOpenDoorOmQuestSetNoMarker','IsFinishedEventOrderNum',
    'IsPresentPartnerPawnNoMarker','IsOmBrokenLayout','IsOmBrokenQuest',
    'IsHoldingPeriodCycleContents','IsNotHoldingPeriodCycleContents','IsResetInstanceArea',
    'CheckMoonAge','IsOrderPawnQuest','IsTakePictures','IsStageForMainQuest',
    'IsReleasePawnExpedition','OpenPpMode','PpNotLess','OpenPpShop','TouchClanBoard',
    'IsOneOffGather','IsOmBrokenLayoutNoMarker','IsOmBrokenQuestNoMarker','KeyItemPointEq',
    'IsEmotion','IsEquipColor','IsEquip','IsTakePicturesNpc','SayMessage',
    'IsTakePicturesWithoutPawn','IsLinkageEnemyFlag','IsLinkageEnemyFlagOff','IsReleaseSecretRoom',
    // 211–256
    'IsSubstoryStateBit18','StoreLinkageEnemyFlagGlobal','SetNpcOrderFlagAndCheckBit18',
    'TalkNpcChoice','SubstoryEnemyHpNotLess','SubstoryEnemyHpLess',
    'SubstoryAvgEnemyHpNotLess','SubstoryAvgEnemyHpLess','IsOmBehaviorState',
    'IsPlayerSpecificLayoutFlag','IsQuestEnemyAlive','IsQuestEnemyAlive2',
    'IsQuestOrAreaEnemyAlive','IsQuestOrAreaEnemyAlive2','IsRewardPointNotLess',
    'OmSetTouchRadius','OmReleaseTouchRadius','QuestTalkNpcRadius','IsOmBrokenInCurrentPhase',
    'IsEnemyFoundRadius','IsEnemyFoundForOrderRadius',
    'IsPawnAvailable','IsSubstoryStateBit19','IsPartyMemberHasItem',
    'IsSubstoryStateBit20','IsSubstoryStateBit21','IsSubstoryStateBit22','IsSubstoryStateBit23',
    'IsFsmNpcTalkComplete','IsSubstoryIngameHourInRange',
    'IsKilledTargetEnemySetGroupMode15','IsKilledTargetEnemySetGroupMode15NoMarker',
    'IsContentsTimerBElapsed','IsQuestClearCountNotLess','IsContentsModeTimerNotLess',
    'IsTriggerFlagSetAndClear','IsKillGroupCompleteInRadius',
    'IsContentsTimerAZero','IsWildHuntTargetEnemyKilled','IsContentsModeStateFlag',
    'Padding254','IsQuestEnemyHpNotGreater','IsAreaLinkageQuestFlagOn',
].sort();

const RESULT_CMD_TYPES = [
    // Ordinals 1–7 (LotOn..QstFlagOn)
    'LotOn','LotOff','HandItem','SetAnnounce','UpdateAnnounce','ChangeMessage','QstFlagOn',
    // Ordinals 8–9 (MyQstFlagOn/GlobalFlagOn) — MyQstFlagOn renamed to avoid check collision
    'MyQstFlagOnFromResult','GlobalFlagOn',
    // Ordinals 10–15 (QstTalkChg..Prt)
    'QstTalkChg','QstTalkDel','StageJump','EventExec','CallMessage','Prt',
    // Ordinals 16–22 (QstLayoutFlagOn..EndCycle)
    'QstLayoutFlagOn','QstLayoutFlagOff','QstSceFlagOn','QstDogmaOrb','GotoMainPwanEdit',
    'AddFsmNpcList','EndCycle',
    // Ordinals 23–49
    'AddCycleTimer','AddMarkerAtItem','AddMarkerAtDest','AddResultPoint',
    'PushImteToPlBag','StartTimer','SetRandom','ResetRandom','BgmRequest','BgmStop',
    'SetWaypoint','ForceTalkQuest','TutorialDialog','AddKeyItemPoint','DontSaveProcess',
    'InterruptCycleContents','QuestEvaluationPoint','CheckOrderCondition',
    'WorldManageLayoutFlagOn','WorldManageLayoutFlagOff','PlayEndingForFirstSeason',
    'AddCyclePurpose','RemoveCyclePurpose','UpdateAnnounceDirect','SetCheckPoint',
    'ReturnCheckPoint','CallGeneralAnnounce',
    // Ordinals 50–61
    'TutorialEnemyInvincibleOff','SetDiePlayerReturnPos',
    'WorldManageQuestFlagOn','WorldManageQuestFlagOff',
    'ReturnCheckPointEx','ResetCheckPoint','ResetDiePlayerReturnPos',
    'SetBarricade','ResetBarricade','TutorialEnemyInvincibleOn','ResetTutorialFlag',
    'StartContentsTimer',
    // Ordinals 62–70 (MyQstFlagOff renamed, PlayCameraEvent..AddAreaPoint)
    'MyQstFlagOffFromResult','PlayCameraEvent','EndEndQuest','ReturnAnnounce',
    'AddEndContentsPurpose','RemoveEndContentsPurpose','StopCycleTimer','RestartCycleTimer',
    'AddAreaPoint',
    // Ordinals 71–86
    'LayoutFlagRandomOn','SetDeliverInfo','SetDeliverInfoQuest','BgmRequestFix',
    'EventExecCont','PlPadOff','PlPadOn','EnableGetSetQuestList','StartMissionAnnounce',
    'StageAnnounce','ReleaseAnnounce','ButtonGuideFlagOn','ButtonGuideFlagOff',
    'AreaJumpFadeContinue','ExeEventAfterStageJump','ExeEventAfterStageJumpContinue',
    // Ordinals 87–98
    'PlayMessage','StopMessage','DecideDivideArea','ShiftPhase','ReleaseMyRoom',
    'DivideSuccess','DivideFailed','SetProgressBonus','RefreshOmKeyDisp',
    'SwitchPawnQuestTalk','LinkageEnemyFlagOn','LinkageEnemyFlagOff',
    // 99–134
    'SubstoryProgress','AddSubstoryProgress','TriggerSubstoryEvent',
    'EnableSubstoryUIElement','DisableSubstoryUIElement','QstTalkChgFsm',
    'SetSubstoryEnemyInvincible','Padding106','AddFsmTalkNpc','SetSubstoryEnemyGroupFlag',
    'EnableSubstoryElementB','DisableSubstoryElementB',
    'SetWorldManageBarrierOn','SetWorldManageBarrierOff','SetFsmNpcSchedule',
    'SetQuestEnemyLevel','SetQuestEnemyLevelEx','SetQuestEnemyTierUp','SetQuestEnemyTierUpEx',
    'SetQuestOmMontageFix','SetQuestOmMontageFixEx','Padding120',
    'SetQuestLayoutEnemyLevel','Padding122','Padding123',
    'RemoveFsmNpcFromSchedule','Padding125','SetEnemyExpeditionState','Padding127',
    'TriggerSubstoryEndSequence','Padding129','CheckSubstoryCondition',
    'Padding131','Padding132','SetPawnExpeditionFlag','SetQuestLayoutEnemyBodyPose',
].sort();

// All known command types for lookups (getCmdParams etc.)
const ALL_CMD_TYPES = Object.keys(CMD_PARAMS).sort();

// Default 4-param fallback for unknown types
const FALLBACK_PARAMS = [
    { name:'Param1' }, { name:'Param2' }, { name:'Param3' }, { name:'Param4' },
];

function getCmdParams(type) {
    return CMD_PARAMS[type] ?? FALLBACK_PARAMS;
}

// Block category definitions  (color, icon)
const BLOCK_CAT = {
    npc:    { color: '#3a7a4a', icon: '🗨' },
    combat: { color: '#8a3a3a', icon: '⚔' },
    item:   { color: '#7a6a2a', icon: '📦' },
    travel: { color: '#2a5a7a', icon: '🗺' },
    event:  { color: '#5a3a7a', icon: '🎬' },
    flag:   { color: '#4a4a7a', icon: '🚩' },
    meta:   { color: '#3a5a5a', icon: '⚙' },
};

// Block type descriptors
// fields: array of field descriptors used in the property panel
const BLOCK_TYPES = {
    // ── NPC ────────────────────────────────────────────────────────────────
    NewNpcTalkAndOrder: {
        cat: 'npc', label: 'NPC Talk & Order (New)',
        fields: ['stage_id', 'npc_id', 'message_id', 'announce_type', 'flags'],
    },
    NpcTalkAndOrder: {
        cat: 'npc', label: 'NPC Talk & Order',
        fields: ['stage_id', 'npc_id', 'message_id', 'announce_type', 'flags'],
    },
    NpcTouchAndOrder: {
        cat: 'npc', label: 'NPC Touch & Order',
        fields: ['stage_id', 'npc_id', 'message_id', 'announce_type', 'flags'],
    },
    QuestNpcTalkAndOrder: {
        cat: 'npc', label: 'Quest NPC Talk & Order',
        fields: ['stage_id', 'npc_id', 'message_id', 'announce_type', 'flags'],
    },
    NewTalkToNpc: {
        cat: 'npc', label: 'Talk to NPC (New)',
        fields: ['stage_id', 'npc_id', 'message_id', 'announce_type', 'flags'],
    },
    TalkToNpc: {
        cat: 'npc', label: 'Talk to NPC',
        fields: ['stage_id', 'npc_id', 'message_id', 'announce_type', 'flags'],
    },
    TouchNpc: {
        cat: 'npc', label: 'Touch NPC',
        fields: ['stage_id', 'npc_id', 'message_id', 'announce_type', 'flags'],
    },
    QstTalkChg: {
        cat: 'npc', label: 'Quest Talk Change',
        fields: ['stage_id', 'npc_id', 'announce_type', 'flags'],
    },

    // ── Combat ─────────────────────────────────────────────────────────────
    DiscoverEnemy: {
        cat: 'combat', label: 'Discover Enemy',
        fields: ['announce_type', 'groups', 'reset_group', 'flags'],
    },
    KillGroup: {
        cat: 'combat', label: 'Kill Group',
        fields: ['announce_type', 'groups', 'reset_group', 'flags'],
    },
    KillTargetEnemies: {
        cat: 'combat', label: 'Kill Target Enemies',
        fields: ['announce_type', 'groups', 'reset_group', 'flags'],
    },
    WeakenGroup: {
        cat: 'combat', label: 'Weaken Group',
        fields: ['announce_type', 'groups', 'reset_group', 'flags'],
    },
    DestroyGroup: {
        cat: 'combat', label: 'Destroy Group',
        fields: ['announce_type', 'groups', 'reset_group', 'flags'],
    },
    SpawnGroup: {
        cat: 'combat', label: 'Spawn Group',
        fields: ['announce_type', 'groups', 'reset_group', 'flags'],
    },
    SeekOutEnemiesAtMarkedLocation: {
        cat: 'combat', label: 'Seek Out Enemies',
        fields: ['announce_type', 'groups', 'reset_group', 'flags'],
    },
    EmDieLight: {
        cat: 'combat', label: 'Enemy Die (Light)',
        fields: ['announce_type', 'flags'],
    },

    // ── Item ───────────────────────────────────────────────────────────────
    NewDeliverItems: {
        cat: 'item', label: 'Deliver Items (New)',
        fields: ['stage_id', 'npc_id', 'message_id', 'items', 'announce_type', 'flags'],
    },
    DeliverItems: {
        cat: 'item', label: 'Deliver Items',
        fields: ['stage_id', 'npc_id', 'message_id', 'items', 'announce_type', 'flags'],
    },
    DeliverItemsLight: {
        cat: 'item', label: 'Deliver Items (Light)',
        fields: ['stage_id', 'npc_id', 'items', 'announce_type', 'flags'],
    },
    CollectItem: {
        cat: 'item', label: 'Collect Item',
        fields: ['stage_id', 'announce_type', 'flags'],
    },

    // ── Travel ─────────────────────────────────────────────────────────────
    StageJump: {
        cat: 'travel', label: 'Stage Jump',
        fields: ['stage_id', 'start_pos_no', 'announce_type', 'flags'],
    },
    PartyGather: {
        cat: 'travel', label: 'Party Gather',
        fields: ['stage_id', 'announce_type', 'flags'],
    },
    ReturnCheckpoint: {
        cat: 'travel', label: 'Return to Checkpoint',
        fields: ['announce_type', 'flags'],
    },
    IsStageNo: {
        cat: 'travel', label: 'Is Stage No',
        fields: ['stage_id'],
    },
    IsGatherPartyInStage: {
        cat: 'travel', label: 'Is Party Gathered in Stage',
        fields: ['stage_id'],
    },
    SceHitIn: {
        cat: 'travel', label: 'Scene Hit In',
        fields: ['stage_id', 'announce_type', 'flags'],
    },
    SceHitOut: {
        cat: 'travel', label: 'Scene Hit Out',
        fields: ['stage_id', 'announce_type', 'flags'],
    },

    // ── Event ──────────────────────────────────────────────────────────────
    PlayEvent: {
        cat: 'event', label: 'Play Event',
        fields: ['stage_id', 'announce_type', 'flags'],
    },
    OmInteractEvent: {
        cat: 'event', label: 'OM Interact Event',
        fields: ['stage_id', 'announce_type', 'flags'],
    },
    ExtendTime: {
        cat: 'event', label: 'Extend Time',
        fields: ['announce_type', 'flags'],
    },

    // ── Flag / State ────────────────────────────────────────────────────────
    MyQstFlags: {
        cat: 'flag', label: 'My Quest Flags',
        fields: ['announce_type', 'set_flags', 'check_flags', 'flags'],
    },

    // ── Meta ───────────────────────────────────────────────────────────────
    DummyBlock: {
        cat: 'meta', label: 'Dummy Block',
        fields: ['announce_type'],
    },
    DummyBlockNoProgress: {
        cat: 'meta', label: 'Dummy Block (No Progress)',
        fields: ['announce_type'],
    },
    End: {
        cat: 'meta', label: 'End',
        fields: ['announce_type', 'flags'],
    },
    GatherItemsLight: {
        cat: 'item', label: 'Gather Items (Light)',
        fields: ['announce_type', 'flags'],
    },
    Raw: {
        cat: 'meta', label: 'Raw Block',
        fields: ['announce_type', 'flags', 'check_commands', 'result_commands'],
    },
    CheckAreaRank: {
        cat: 'meta', label: 'Check Area Rank',
        fields: [],
    },
    IsQuestOrdered: {
        cat: 'meta', label: 'Is Quest Ordered',
        fields: [],
    },
    IsQuestClear: {
        cat: 'meta', label: 'Is Quest Clear',
        fields: [],
    },
    MainQuestCompleted: {
        cat: 'meta', label: 'Main Quest Completed',
        fields: [],
    },
    ClearPersonalQuest: {
        cat: 'meta', label: 'Clear Personal Quest',
        fields: ['announce_type'],
    },
    MinimumVocationLevel: {
        cat: 'meta', label: 'Minimum Vocation Level',
        fields: [],
    },
    PartyNumNotLessWithPawn: {
        cat: 'meta', label: 'Party Num Not Less With Pawn',
        fields: [],
    },
    AreaRank: {
        cat: 'meta', label: 'Area Rank',
        fields: [],
    },
};

// All known block type keys sorted for UI dropdowns
const ALL_BLOCK_TYPES = Object.keys(BLOCK_TYPES).sort();

// ── Persistence keys ──────────────────────────────────────────────────────────
const LS_QUEST        = 'questBuilder_quest';   // working copy (may have unsaved changes)
const LS_CLEAN_QUEST  = 'questBuilder_clean';   // last saved/loaded from disk
const LS_DIRTY        = 'questBuilder_dirty';   // '1' if there are unsaved changes, '0' otherwise
const LS_CAM          = 'questBuilder_cam';
const LS_PROP_W       = 'questBuilder_propW';
const LS_PANEL_STATES = 'questBuilder_panels';  // { fname → {x,y,w,h,pinned,labels} }
const LS_SRC_LOADED   = 'questBuilder_srcLoaded'; // '1' if source files were loaded last session
// Aux viewers key is dynamic — call auxViewersKey() to get the current one
const IDB_NAME    = 'questBuilder';
const IDB_STORE   = 'handles';

// ── State ─────────────────────────────────────────────────────────────────────
let _quest       = null;   // the loaded quest object
let _selection   = null;   // { proc: number, block: number } | null
let _copiedBlock  = null;   // deep-clone of last copied block
let _copiedEnemy  = null;   // deep-clone of last copied enemy (for spawn paste)
let _focusedProc = null;   // number | null — if set, only that process is shown on canvas
let _fileHandle  = null;   // FileSystemFileHandle of the current file (File System Access API)
let _cleanJson   = null;   // JSON snapshot after last load/save — dirty tracking
let _clientHandle      = null;  // FileSystemDirectoryHandle — decoded client data root
let _translationHandle = null;  // FileSystemDirectoryHandle — DDON-translation repo root
let _selectedLang      = localStorage.getItem('ddon-lang') || 'English';
let _msgMap            = null;  // Map<key,{jp,en,lang?}> loaded from gmd.csv
let _npcNameMap        = null;  // Map<npcId string,{en,jp,lang?}> cross-ref from gmd npc_name entries
let _epData            = null;  // enemyPositions.json cache (lazy-loaded, ~20MB)
let _loadedSourceFiles = null;  // { fname: data } — cached after spider loads
let _mssGroupMap       = null;  // Map<groupSerial, {npcName, msgs:[{en,jp}]}> built from mss files
let _auxViewers        = [];   // [{ id, questId, x, y }] — auxiliary quest viewer cards on the canvas
let _auxQuestIndex     = null; // [{ id: number }] sorted, lazily built from client dir scan; null = not yet loaded
let _auxQuestNames     = new Map(); // id → name string (lazily loaded from QTD files)

// Camera state
let _cam = { x: 0, y: 0, z: 1.0 };
let _isPanning = false;
let _panMoved  = false;
let _suppressNextDocClick = false;
let _panStart  = { x: 0, y: 0, cx: 0, cy: 0 };
let _spaceDown = false;

// Drag-and-drop state
let _drag = null;
// {
//   srcProc: number,  srcBlock: number,   // origin
//   startX: number,   startY: number,     // mousedown screen coords
//   live: bool,                           // crossed threshold yet?
//   ghost: HTMLElement,                   // floating clone
//   placeholder: HTMLElement,             // grey slot in target lane
//   overProc: number|null,               // lane currently hovered
//   insertAt: number|null,               // index to insert at
// }

// Layout constants
const LANE_HEADER_W  = 36;
const BLOCK_W        = 210;
const BLOCK_GAP      = 60;   // space between blocks (for arrows)
const LANE_H         = 195;  // lane body padding (20px top+bottom) + fixed block height (150px)
const LANE_PAD_V     = 20;   // vertical padding inside lane body
const LANE_PAD_H     = 16;
const META_CARD_H    = 200;  // height of the meta card + gap before first lane (tall enough for news image)
const META_CARD_GAP  = 20;
const EG_CARD_LEFT   = 420;  // enemy groups card: left of meta card (400px) + 20px gap
const EG_CARD_W      = 330;
const SRC_CARD_W     = 200;  // source files card width
const SRC_CARD_LEFT  = -(SRC_CARD_W + 30);  // 30px gap to the left of meta card

// ── DOM references ─────────────────────────────────────────────────────────────
const canvasWrap    = document.getElementById('canvas-wrap');
const world         = document.getElementById('world');
const svgLayer      = document.getElementById('svg-layer');
const canvasEmpty   = document.getElementById('canvas-empty');
const hintBar       = document.getElementById('hint-bar');
const processList   = document.getElementById('process-list');
const procCount     = document.getElementById('proc-count');
const propBody      = document.getElementById('prop-body');
const propHeaderSub = document.getElementById('prop-header-sub');
const propDelete    = document.getElementById('prop-delete-block');
const zoomDisplay   = document.getElementById('zoom-display');
const questIdDisplay      = document.getElementById('quest-id-display');
const questVariantDisplay = document.getElementById('quest-variant-display');
const questTitleDisplay   = document.getElementById('quest-title-display');
const fileInput     = document.getElementById('file-input');

// ── Helpers ───────────────────────────────────────────────────────────────────
const npcName  = id  => (typeof id === 'number' ? npcNames[String(id)] : npcNames[id]) ?? id ?? '?';
// npcPrimaryName: returns translated name if available, else English, for given ID (string or number)
function npcPrimaryName(id) {
    const key = String(id ?? '');
    if (!key) return '';
    if (_npcNameMap) {
        const e = _npcNameMap.get(key);
        if (e) return (_selectedLang !== 'English' && e.lang) ? e.lang : e.en;
    }
    return npcNames[key] ?? key;
}
// npcDisplayLabel: "Name #id" format for picker display
const npcDisplayLabel = id => { const n = npcPrimaryName(id); const k = String(id ?? ''); return n && n !== k ? `${n} #${k}` : (k ? `#${k}` : ''); };
const itemEntry = id => (typeof id === 'number' ? itemNames[String(id)] : itemNames[id]) ?? null;
const itemName  = id => itemEntry(id)?.name ?? (id != null ? `item ${id}` : '');
const itemIconPath = id => { const e = itemEntry(id); return e ? `images/icons/small/ii${String(e.iconNo).padStart(6,'0')}.png` : null; };
// enemy_id "0x015820" → key "em015820" for emNames lookup
const emNameKey      = id => id ? `em${String(id).replace(/^0x/i,'').toLowerCase()}` : null;
const emName         = id => { const k = emNameKey(id); return k ? (emNames[k]?.name ?? '') : ''; };
const emDisplayLabel = id => { const n = emName(id); const k = emNameKey(id); return n ? `${n} · ${k}` : (id ?? ''); };
// think-table info for a given hex enemy_id
const emThink = id => { const k = emNameKey(id); return k ? (emThinkInfo[k] ?? null) : null; };
// montage valid indices for a given hex enemy_id (null = no data, [] = none recorded)
const emMontage = id => { const k = emNameKey(id); return k ? (emMontageInfo[k] ?? null) : null; };
// hm preset entry for a given hex enemy_id
const emHmPreset = id => { const k = emNameKey(id); return k ? (hmPresetsByEmCode.get(k) ?? null) : null; };
// Full display name for an enemy object, applying named param prefix/suffix/replace
const enDisplayName = en => {
    const base  = emName(en.enemy_id) || en.enemy_id || '';
    const np    = en.named_enemy_params_id ? namedParamsById.get(en.named_enemy_params_id) : null;
    return namedParamDisplayName(np, base) ?? base;
};

// ── Named param helpers ────────────────────────────────────────────────────────
function namedParamLabel(p) {
    if (!p || p.id === 0) return '0 — None';
    const name = p.name?.trim();
    const tag = p.type === 'NAMED_TYPE_PREFIX'  ? ' [Pfx]'
              : p.type === 'NAMED_TYPE_REPLACE'  ? ' [Rep]'
              : p.type === 'NAMED_TYPE_SUFFIX'   ? ' [Sfx]'
              : '';
    return name ? `${p.id}: ${name}${tag}` : `#${p.id}${tag}`;
}
// Returns the combined enemy display name with the param applied, or null if no name change.
function namedParamDisplayName(p, baseEmName) {
    const name = p?.name?.trim();
    if (!name || !p || p.id === 0 || p.type === 'NAMED_TYPE_NONE') return baseEmName ?? null;
    if (p.type === 'NAMED_TYPE_REPLACE') return baseEmName ? `${name} (${baseEmName})` : name;
    if (p.type === 'NAMED_TYPE_PREFIX')  return baseEmName ? `${name} ${baseEmName}` : name;
    if (p.type === 'NAMED_TYPE_SUFFIX')  return baseEmName ? `${baseEmName} ${name}` : name;
    return baseEmName ?? null;
}
// Returns HTML showing the combined name with the param part highlighted.
function namedParamCombinedHtml(p, baseEmName) {
    const name = p?.name?.trim();
    if (!name || !p || p.id === 0 || p.type === 'NAMED_TYPE_NONE') return escHtml(baseEmName ?? '');
    const hi  = `<span class="np-name-hi">${escHtml(name)}</span>`;
    const em  = escHtml(baseEmName ?? '…');
    if (p.type === 'NAMED_TYPE_REPLACE') return baseEmName
        ? `${hi} <span class="np-orig-inline">(${em})</span>`
        : hi;
    if (p.type === 'NAMED_TYPE_PREFIX')  return `${hi} ${em}`;
    if (p.type === 'NAMED_TYPE_SUFFIX')  return `${em} ${hi}`;
    return em;
}

const stName   = sid => {
    if (!sid) return '?';
    const key = String(sid.id ?? sid);
    const e = stageNames[key];
    if (e) return `${e.name} (${e.code}, #${key})`;
    return `#${key}`;
};
const stNameHtml = sid => {
    if (!sid) return { html: '<span class="detail-stage-name">?</span>' };
    const key = String(sid.id ?? sid);
    const e = stageNames[key];
    if (e) return { html: `<span class="detail-stage-name">${escHtml(e.name)}</span><span class="detail-stage-sub">${escHtml(e.code)}, #${key}</span>` };
    return { html: `<span class="detail-stage-name">#${key}</span>` };
};

// ── Stage picker (fuzzy search combobox) ──────────────────────────────────────
function stageDisplayLabel(id, entry) {
    if (!entry) return id != null && id !== '' ? `#${id}` : '';
    const suffix = entry.name !== entry.field ? ` — ${entry.field}` : '';
    return `${entry.name}${suffix} (${entry.code}, #${id})`;
}

// ── Command picker (fuzzy search with param signature) ────────────────────────
function buildCmdPicker(onAdd, types = ALL_CMD_TYPES) {
    const wrap = document.createElement('div');
    wrap.className = 'cmd-picker';
    wrap.innerHTML = `
        <input type="text" class="cmd-picker-input prop-input"
               placeholder="Search command to add…" autocomplete="off" spellcheck="false">
        <div class="cmd-picker-dropdown"></div>`;

    const input    = wrap.querySelector('.cmd-picker-input');
    const dropdown = wrap.querySelector('.cmd-picker-dropdown');

    function populate(query) {
        const q = (query ?? '').toLowerCase().trim();
        const matches = types.filter(t => !q || t.toLowerCase().includes(q)).slice(0, 60);
        dropdown.innerHTML = matches.map(t => {
            const params = getCmdParams(t);
            const sig = params.length ? params.map(p => p.name).join(', ') : '(no params)';
            return `<div class="cmd-option" data-type="${escAttr(t)}" title="${escAttr(t)}: ${escAttr(sig)}">
                <span class="cmd-opt-name">${escHtml(t)}</span>
                <span class="cmd-opt-sig">${escHtml(sig)}</span>
            </div>`;
        }).join('');
        dropdown.style.display = matches.length ? 'block' : 'none';
        dropdown.querySelectorAll('.cmd-option').forEach(opt => {
            opt.addEventListener('mousedown', e => {
                e.preventDefault();
                input.value = '';
                dropdown.style.display = 'none';
                onAdd(opt.dataset.type);
            });
        });
    }

    input.addEventListener('focus', () => populate(input.value));
    input.addEventListener('input', () => populate(input.value));
    input.addEventListener('blur',  () => { setTimeout(() => { dropdown.style.display = 'none'; }, 160); });

    return wrap;
}

// ── Item picker (fuzzy search with icon) ──────────────────────────────────────
function buildItemPicker(currentId, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'item-picker';

    const entry    = itemEntry(currentId);
    const iconPath = entry ? `images/icons/small/ii${String(entry.iconNo).padStart(6,'0')}.png` : null;

    const displayName = entry ? entry.name : (currentId != null ? `item ${currentId}` : '');
    wrap.innerHTML = `
        <div class="item-picker-display">
            <img class="item-picker-icon" src="${iconPath ?? ''}" alt="" ${iconPath ? '' : 'style="display:none"'}>
            <input type="text" class="item-picker-input prop-input"
                   value="${escAttr(displayName)}"
                   title="${escAttr(displayName)}"
                   placeholder="Search item name or ID…"
                   autocomplete="off" spellcheck="false">
        </div>
        <div class="item-picker-dropdown"></div>`;

    const icon     = wrap.querySelector('.item-picker-icon');
    const input    = wrap.querySelector('.item-picker-input');
    const dropdown = wrap.querySelector('.item-picker-dropdown');

    function populate(query) {
        const q = (query ?? '').toLowerCase().trim();
        const isNum = /^\d+$/.test(q);
        const entries = Object.entries(itemNames);
        const matches = entries.filter(([id, e]) => {
            if (!q) return true;
            if (isNum) return id.startsWith(q);
            return e.name.toLowerCase().includes(q);
        }).slice(0, 40);

        dropdown.innerHTML = matches.map(([id, e]) => {
            const ip = `images/icons/small/ii${String(e.iconNo).padStart(6,'0')}.png`;
            return `<div class="item-option" data-id="${id}" title="${escAttr(e.name)} (#${id})">
                <img class="item-opt-icon" src="${ip}" alt="">
                <span class="item-opt-name">${escHtml(e.name)}</span>
                <span class="item-opt-id">#${id}</span>
            </div>`;
        }).join('');

        dropdown.style.display = matches.length ? 'block' : 'none';

        dropdown.querySelectorAll('.item-option').forEach(opt => {
            opt.addEventListener('mousedown', e => {
                e.preventDefault();
                const id  = parseInt(opt.dataset.id);
                const se  = itemEntry(id);
                const name = se ? se.name : `item ${id}`;
                input.value = name;
                input.title = name;
                const ip = se ? `images/icons/small/ii${String(se.iconNo).padStart(6,'0')}.png` : null;
                icon.src = ip ?? '';
                icon.style.display = ip ? '' : 'none';
                dropdown.style.display = 'none';
                onChange(id);
            });
        });
    }

    input.addEventListener('focus', () => populate(input.value));
    input.addEventListener('input', () => populate(input.value));
    input.addEventListener('blur',  () => { setTimeout(() => { dropdown.style.display = 'none'; }, 160); });

    return wrap;
}

// ── NPC picker (fuzzy search, shows "Name #id" for all to handle duplicates) ──
const NPC_PARAM_NAMES = new Set(['NpcId', 'NpcId01', 'NpcId02', 'NpcId03']);
const MSG_PARAM_NAMES = new Set(['GroupSerial', 'NoOrderGroupSerial', 'OrderGroupSerial', 'MsgNo']);

function buildNpcPicker(currentId, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'npc-picker';

    const displayLabel = currentId != null && currentId !== '' ? npcDisplayLabel(currentId) : '';
    const jpName = currentId != null && currentId !== '' && _npcNameMap?.get(String(currentId))?.jp || '';
    wrap.innerHTML = `
        <input type="text" class="npc-picker-input prop-input"
               value="${escAttr(displayLabel)}"
               title="${escAttr(jpName || displayLabel)}"
               placeholder="Search NPC name or ID…"
               autocomplete="off" spellcheck="false">
        <div class="npc-picker-dropdown"></div>`;

    const input    = wrap.querySelector('.npc-picker-input');
    const dropdown = wrap.querySelector('.npc-picker-dropdown');

    function populate(query) {
        const q = (query ?? '').toLowerCase().trim();
        const isNum = /^\d+$/.test(q);
        // Build sorted list from npcNames: [{id, name, jp, label}]
        const allNpcs = Object.entries(npcNames).map(([id, en]) => {
            const mapEntry = _npcNameMap?.get(id);
            const primary = mapEntry ? ((_selectedLang !== 'English' && mapEntry.lang) ? mapEntry.lang : mapEntry.en) : en;
            const jp      = mapEntry?.jp ?? null;
            const label   = `${primary} #${id}`;
            return { id, primary, jp, label };
        });
        const matches = allNpcs.filter(({ id, primary, jp }) => {
            if (!q) return false; // require at least 1 char
            if (isNum) return id.startsWith(q);
            return primary.toLowerCase().includes(q) || (jp && jp.toLowerCase().includes(q));
        }).slice(0, 20);

        dropdown.innerHTML = matches.map(({ id, primary, jp }) =>
            `<div class="npc-option" data-id="${escAttr(id)}" title="${escAttr(jp ? `${jp} (${primary})` : primary)}">
                <span class="npc-opt-name">${escHtml(primary)}</span>
                <span class="npc-opt-id">#${id}</span>
                ${jp ? `<span class="npc-opt-jp">${escHtml(jp)}</span>` : ''}
            </div>`
        ).join('');

        dropdown.style.display = matches.length ? 'block' : 'none';

        dropdown.querySelectorAll('.npc-option').forEach(opt => {
            opt.addEventListener('mousedown', e => {
                e.preventDefault();
                const id    = opt.dataset.id;
                const label = npcDisplayLabel(id);
                const jp    = _npcNameMap?.get(id)?.jp ?? '';
                input.value = label;
                input.title = jp || label;
                dropdown.style.display = 'none';
                onChange(id); // always a string
            });
        });
    }

    input.addEventListener('focus', () => populate(input.value));
    input.addEventListener('input', () => populate(input.value));
    input.addEventListener('blur',  () => { setTimeout(() => { dropdown.style.display = 'none'; }, 160); });

    return wrap;
}

// ── MSS message picker (fuzzy search by serial, NPC name, or message text) ──
// Short label shown inside the picker input (name + NPC ID only)
function msgInputLabel(serial) {
    if (serial == null || serial === '') return '';
    const entry = _mssGroupMap?.get(Number(serial));
    if (!entry) return `#${serial}`;
    return entry.npcId != null ? `${entry.npcName} #${entry.npcId}` : entry.npcName;
}

// Full label used elsewhere (e.g. canvas chip title)
function msgDisplayLabel(serial) {
    if (serial == null || serial === '') return '';
    const entry = _mssGroupMap?.get(Number(serial));
    if (!entry) return `#${serial}`;
    const npcPart = entry.npcId != null ? `${entry.npcName} #${entry.npcId}` : entry.npcName;
    return `${npcPart} serial:${serial}`;
}

function buildMsgPicker(currentSerial, onChange, filterNpcId = null) {
    const wrap = document.createElement('div');
    wrap.className = 'msg-picker';

    // When filtering by NPC, show all their groups on focus without typing
    const npcFiltered = filterNpcId != null && _mssGroupMap != null;
    const placeholder = !_mssGroupMap
        ? 'Serial number…'
        : npcFiltered ? 'Filter by serial or message…'
        : 'Search by serial, NPC, or message…';

    const inputVal    = currentSerial != null ? String(currentSerial) : '';
    const serialBadge = currentSerial != null ? `<span class="msg-serial-badge">${escHtml(msgInputLabel(currentSerial))}</span>` : '';
    wrap.innerHTML = `
        <div class="msg-picker-inner">
            <input type="text" class="msg-picker-input prop-input"
                   value="${escAttr(inputVal)}"
                   placeholder="${escAttr(placeholder)}"
                   autocomplete="off" spellcheck="false">
            ${serialBadge}
            ${currentSerial != null ? `<button class="msg-preview-chip msg-picker-chip" data-serial="${currentSerial}" title="Preview messages">💬</button>` : ''}
        </div>
        <div class="msg-picker-dropdown"></div>`;

    const input    = wrap.querySelector('.msg-picker-input');
    const dropdown = wrap.querySelector('.msg-picker-dropdown');
    const inner    = wrap.querySelector('.msg-picker-inner');

    wrap.querySelector('.msg-picker-chip')?.addEventListener('click', e => {
        e.stopPropagation();
        showMsgPreview(e.currentTarget, Number(e.currentTarget.dataset.serial));
    });

    function setSelected(serial) {
        input.value = serial != null ? String(serial) : '';
        // Update or remove NPC name badge
        inner.querySelector('.msg-serial-badge')?.remove();
        inner.querySelector('.msg-picker-chip')?.remove();
        if (serial != null) {
            const badge = document.createElement('span');
            badge.className = 'msg-serial-badge';
            badge.textContent = msgInputLabel(serial);
            const chip = document.createElement('button');
            chip.className = 'msg-preview-chip msg-picker-chip';
            chip.dataset.serial = serial;
            chip.title = 'Preview messages';
            chip.textContent = '💬';
            chip.addEventListener('click', e => { e.stopPropagation(); showMsgPreview(chip, serial); });
            input.after(badge);
            badge.after(chip);
        }
        dropdown.style.display = 'none';
        onChange(serial);
    }

    function populate(query) {
        if (!_mssGroupMap) { dropdown.style.display = 'none'; return; }
        const q = (query ?? '').toLowerCase().trim();
        const isNum = /^\d+$/.test(q);
        // When NPC-filtered: show all NPC entries on empty query; hide only when no match on typed query
        if (!npcFiltered && !q) { dropdown.style.display = 'none'; return; }

        const matches = [];
        for (const [serial, entry] of _mssGroupMap) {
            // NPC filter: skip entries not belonging to this NPC
            if (npcFiltered && entry.npcId !== filterNpcId) continue;

            if (q) {
                const serialStr   = String(serial);
                const nameMatch   = entry.npcName.toLowerCase().includes(q);
                const serialMatch = isNum ? serialStr.startsWith(q) : false;
                const npcIdMatch  = isNum && entry.npcId != null ? String(entry.npcId).startsWith(q) : false;
                const msgMatch    = entry.msgs.some(m =>
                    m.en.toLowerCase().includes(q) || m.jp.toLowerCase().includes(q));
                if (!nameMatch && !serialMatch && !npcIdMatch && !msgMatch) continue;
            }

            matches.push({ serial, entry });
            if (matches.length >= 50) break;
        }

        dropdown.innerHTML = matches.map(({ serial, entry }) => {
            const first    = entry.msgs[0] ?? {};
            const previewEn = first.en ? first.en.slice(0, 80) + (first.en.length > 80 ? '…' : '') : '';
            const previewJp = first.jp ? first.jp.slice(0, 60) + (first.jp.length > 60 ? '…' : '') : '';
            // When NPC-filtered, no need to show NPC name (it's the same for all)
            const npcLabel = npcFiltered
                ? ''
                : entry.npcId != null
                    ? `${escHtml(entry.npcName)} <span class="msg-opt-npcid">#${entry.npcId}</span>`
                    : escHtml(entry.npcName);
            return `<div class="msg-option" data-serial="${serial}">
                <div class="msg-opt-hdr">
                    ${npcLabel ? `<span class="msg-opt-name">${npcLabel}</span>` : ''}
                    <span class="msg-opt-serial">serial:${serial}</span>
                </div>
                ${previewEn ? `<div class="msg-opt-preview">${escHtml(previewEn)}</div>` : ''}
                ${previewJp ? `<div class="msg-opt-preview msg-opt-preview--jp">${escHtml(previewJp)}</div>` : ''}
            </div>`;
        }).join('');

        dropdown.style.display = matches.length ? 'block' : 'none';

        dropdown.querySelectorAll('.msg-option').forEach(opt => {
            opt.addEventListener('mousedown', e => {
                e.preventDefault();
                setSelected(parseInt(opt.dataset.serial));
            });
        });
    }

    input.addEventListener('focus', () => populate(input.value));
    input.addEventListener('input', () => populate(input.value));
    input.addEventListener('blur', () => {
        setTimeout(() => { dropdown.style.display = 'none'; }, 160);
        // Accept raw number typed directly
        const raw = input.value.trim();
        const asNum = parseInt(raw);
        if (raw !== '' && !isNaN(asNum)) {
            setSelected(asNum);
        } else if (raw === '') {
            setSelected(null);
        }
    });

    return wrap;
}

// ── Enemy picker (fuzzy search by name or hex ID, always shows ID to disambiguate) ──
function buildEmPicker(currentHexId, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'em-picker';

    const displayVal = emDisplayLabel(currentHexId);
    wrap.innerHTML = `
        <input type="text" class="em-picker-input prop-input"
               value="${escAttr(displayVal)}"
               title="${escAttr(displayVal)}"
               placeholder="Search enemy name or ID…"
               autocomplete="off" spellcheck="false"
               style="font-size:11px">
        <div class="em-picker-dropdown"></div>`;

    const input    = wrap.querySelector('.em-picker-input');
    const dropdown = wrap.querySelector('.em-picker-dropdown');

    function populate(query) {
        const q = (query ?? '').toLowerCase().trim();
        if (!q) { dropdown.style.display = 'none'; return; }
        // Hex-like query → match on key; otherwise → match on name
        const isHex = /^(0x|em)?[0-9a-f]+$/i.test(q);
        const qHex  = q.replace(/^(0x|em)/i, '');
        const entries = Object.entries(emNames);
        const filtered = entries.filter(([k, v]) =>
            isHex ? k.slice(2).includes(qHex) : (v.name || '').toLowerCase().includes(q)
        ).slice(0, 30);

        dropdown.innerHTML = filtered.map(([k, v]) =>
            `<div class="em-option" data-emkey="${escAttr(k)}" title="${escAttr(`${v.name || k} (${k})`)}">
                <span class="em-opt-name">${escHtml(v.name || k)}</span>
                <span class="em-opt-id">${escHtml(k)}</span>
            </div>`
        ).join('');
        dropdown.style.display = filtered.length ? 'block' : 'none';

        dropdown.querySelectorAll('.em-option').forEach(opt => {
            opt.addEventListener('mousedown', e => {
                e.preventDefault();
                const emKey = opt.dataset.emkey;
                const hexId = '0x' + emKey.replace(/^em/i, '').toUpperCase();
                const label = emDisplayLabel(hexId);
                input.value = label;
                input.title = label;
                dropdown.style.display = 'none';
                onChange(hexId);
            });
        });
    }

    input.addEventListener('focus', () => populate(input.value));
    input.addEventListener('input', () => populate(input.value));
    input.addEventListener('blur', () => {
        setTimeout(() => {
            dropdown.style.display = 'none';
            // Accept raw hex entry (0xNNNNNN, emNNNNNN, or bare hex digits)
            const raw = input.value.trim();
            const m = raw.match(/(?:0x|em)?([0-9a-f]{4,6})/i);
            if (m) {
                const digits = m[1].toLowerCase().padStart(6, '0');
                const hexId  = '0x' + digits.toUpperCase();
                const label  = emDisplayLabel(hexId);
                input.value  = label;
                input.title  = label;
                onChange(hexId);
            }
        }, 160);
    });

    return wrap;
}

function buildStagePicker(currentId, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'stage-picker';

    const entry = stageNames[String(currentId ?? '')];
    const displayVal = stageDisplayLabel(currentId, entry);

    wrap.innerHTML = `
        <input type="text" class="stage-picker-input prop-input"
               value="${escAttr(displayVal)}"
               placeholder="Search name, code or stage #"
               autocomplete="off" spellcheck="false">
        <div class="stage-picker-dropdown"></div>`;

    const input    = wrap.querySelector('.stage-picker-input');
    const dropdown = wrap.querySelector('.stage-picker-dropdown');

    function populate(query) {
        const q = (query ?? '').toLowerCase().trim();
        const entries = Object.entries(stageNames);
        const matches = entries.filter(([id, s]) => {
            if (!q) return true;
            return String(id).includes(q)
                || s.name.toLowerCase().includes(q)
                || s.code.toLowerCase().includes(q)
                || s.field.toLowerCase().includes(q);
        }).slice(0, 30);

        dropdown.innerHTML = matches.map(([id, s]) => {
            const sub = s.name !== s.field ? `${escHtml(s.field)} · ` : '';
            return `<div class="stage-option" data-id="${id}">
                <span class="stage-opt-name">${escHtml(s.name)}</span>
                <span class="stage-opt-sub">${sub}${escHtml(s.code)} · #${id}</span>
            </div>`;
        }).join('');

        dropdown.style.display = matches.length ? 'block' : 'none';

        dropdown.querySelectorAll('.stage-option').forEach(opt => {
            opt.addEventListener('mousedown', e => {
                e.preventDefault();
                const id = parseInt(opt.dataset.id);
                const se = stageNames[String(id)];
                input.value = stageDisplayLabel(id, se);
                dropdown.style.display = 'none';
                onChange(id);
            });
        });
    }

    input.addEventListener('focus', () => populate(input.value));
    input.addEventListener('input', () => populate(input.value));
    input.addEventListener('blur',  () => { setTimeout(() => { dropdown.style.display = 'none'; }, 160); });

    return wrap;
}

function blockTypeInfo(type) {
    return BLOCK_TYPES[type] ?? { cat: 'meta', label: type, fields: [] };
}

function blockCatStyle(type) {
    const info = blockTypeInfo(type);
    const cat  = BLOCK_CAT[info.cat] ?? BLOCK_CAT.meta;
    return `background:${cat.color};`;
}

function blockSummary(block) {
    const lines = [];
    if (block.checkpoint)         lines.push('🔖 checkpoint');
    if (block.npc_id)             lines.push(npcName(block.npc_id));
    if (block.stage_id)           lines.push(stNameHtml(block.stage_id));
    if (block.message_id != null) {
        const mid = block.message_id;
        const mssEntry = _mssGroupMap?.get(mid);
        const chipCls  = mssEntry ? 'msg-preview-chip' : 'msg-preview-chip msg-preview-chip--dim';
        const npcLabel = mssEntry ? (mssEntry.npcId != null ? `${mssEntry.npcName} #${mssEntry.npcId}` : mssEntry.npcName) : null;
        const chipLbl  = npcLabel ? `💬 ${escHtml(npcLabel)}` : `💬 #${mid}`;
        const chipTip  = npcLabel ? escAttr(npcLabel) : 'Load source files to preview';
        lines.push({ html: `<button class="${chipCls}" data-serial="${mid}" title="${chipTip}">${chipLbl}</button>` });
    }
    if (block.groups?.length) {
        const egs = _quest?.enemy_groups || [];
        const chips = block.groups.map(gi => {
            const g = egs[gi];
            const sid = g?.stage_id || {};
            const stLbl = sid.id != null ? `St.${sid.id}` : '?';
            const grpLbl = sid.group_id != null ? `/G${sid.group_id}` : '';
            const count = (g?.enemies || []).length;
            return `<span class="eg-chip eg-chip-on eg-chip-node">` +
                `<span class="eg-chip-idx">#${gi}</span>` +
                `<span class="eg-chip-stage">${stLbl}${grpLbl}</span>` +
                `<span class="eg-chip-count">${count}em</span>` +
                `</span>`;
        }).join('');
        lines.push({ html: `<div class="eg-node-chips">${chips}</div>` });
    }
    if (block.items?.length)      lines.push(`${block.items.length} item(s)`);
    return lines;
}

// ── Flag dependency analysis ──────────────────────────────────────────────────

// Returns the MyQst flag values a block sets and checks.
function blockFlagKeys(block) {
    const sets   = new Set();
    const checks = new Set();
    for (const f of (block.flags || [])) {
        if (f.type === 'MyQst' && (f.action === 'Set' || f.action === 'Clear'))
            sets.add(f.value);
    }
    for (const v of (block.set_flags   || [])) sets.add(v);
    for (const c of (block.check_commands || [])) {
        if (c.type === 'MyQstFlagOn' || c.type === 'MyQstFlagOff') checks.add(c.Param1);
    }
    for (const v of (block.check_flags || [])) checks.add(v);
    return { sets, checks };
}

// For the block at [pi,bi], returns Sets of "pi:bi" keys for upstream and downstream blocks.
function findFlagDeps(pi, bi) {
    const processes = _quest?.processes || [];

    // Build global map: flagValue → {setters, checkers}
    const map = new Map();
    processes.forEach((proc, pIdx) => {
        (proc.blocks || []).forEach((block, bIdx) => {
            const { sets, checks } = blockFlagKeys(block);
            const key = `${pIdx}:${bIdx}`;
            sets.forEach(v => {
                if (!map.has(v)) map.set(v, { setters: new Set(), checkers: new Set() });
                map.get(v).setters.add(key);
            });
            checks.forEach(v => {
                if (!map.has(v)) map.set(v, { setters: new Set(), checkers: new Set() });
                map.get(v).checkers.add(key);
            });
        });
    });

    const thisBlock = processes[pi]?.blocks?.[bi];
    if (!thisBlock) return { upstream: new Set(), downstream: new Set() };

    const { sets, checks } = blockFlagKeys(thisBlock);
    const self = `${pi}:${bi}`;
    const upstream   = new Set(); // set flags this block checks
    const downstream = new Set(); // check flags this block sets

    checks.forEach(v => map.get(v)?.setters .forEach(k => { if (k !== self) upstream  .add(k); }));
    sets  .forEach(v => map.get(v)?.checkers.forEach(k => { if (k !== self) downstream.add(k); }));

    return { upstream, downstream };
}

function clearDepHighlights() {
    world.querySelectorAll('.dep-upstream, .dep-downstream')
        .forEach(n => n.classList.remove('dep-upstream', 'dep-downstream'));
    document.getElementById('dep-legend')?.classList.remove('visible');
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
    initPropResize();

    // Toolbar buttons
    document.getElementById('btn-new').addEventListener('click', newQuest);
    document.getElementById('btn-load').addEventListener('click', openQuestFile);
    document.getElementById('btn-load-url').addEventListener('click', loadFromUrl);
    document.getElementById('btn-save').addEventListener('click', saveQuest);
    document.getElementById('btn-save-as').addEventListener('click', saveQuestAs);
    document.getElementById('btn-reload-disk').addEventListener('click', reloadFromDisk);
    document.getElementById('btn-add-process').addEventListener('click', addProcess);
    document.getElementById('btn-show-all').addEventListener('click', () => {
        _focusedProc = null;
        render(); renderPropPanel();
    });

    // File input (fallback for browsers without showOpenFilePicker)
    fileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => loadQuestJson(ev.target.result, file.name);
        reader.readAsText(file);
        fileInput.value = '';
    });

    // Warn before leaving with unsaved changes
    window.addEventListener('beforeunload', e => {
        if (isDirty()) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // Canvas pan/zoom — move/up on window so drag works outside the canvas
    canvasWrap.addEventListener('mousedown', onCanvasMouseDown);
    window.addEventListener('mousemove', onCanvasMouseMove);
    window.addEventListener('mouseup',   onCanvasMouseUp);
    canvasWrap.addEventListener('wheel',     onCanvasWheel, { passive: false });

    // Right-click context menu — add auxiliary viewers
    canvasWrap.addEventListener('contextmenu', e => {
        e.preventDefault();
        document.querySelector('.canvas-ctx-menu')?.remove();
        const menu = document.createElement('div');
        menu.className = 'canvas-ctx-menu';
        menu.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;z-index:9000;`;
        menu.innerHTML = `<button class="ctx-menu-item">📁 Add Auxiliary Viewer</button>`;
        const closeMenu = () => { menu.remove(); document.removeEventListener('click', closeMenu); };
        menu.querySelector('.ctx-menu-item').addEventListener('click', () => {
            const rect = canvasWrap.getBoundingClientRect();
            const worldX = (e.clientX - rect.left - _cam.x) / _cam.z;
            const worldY = (e.clientY - rect.top  - _cam.y) / _cam.z;
            addAuxViewer(worldX, worldY);
            closeMenu();
        });
        document.body.appendChild(menu);
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    });

    // Spacebar pan — hold space to grab-pan from anywhere over the canvas
    window.addEventListener('keydown', e => {
        if (e.code === 'Space' && !e.target.matches('input, textarea, [contenteditable]')) {
            if (!_spaceDown) { _spaceDown = true; canvasWrap.style.cursor = 'grab'; }
            e.preventDefault();
        }
    });
    window.addEventListener('keyup', e => {
        if (e.code === 'Space') {
            _spaceDown = false;
            canvasWrap.style.cursor = '';
            if (_isPanning) { _isPanning = false; canvasWrap.classList.remove('panning'); }
        }
    });

    // Prop panel delete button
    propDelete.addEventListener('click', deleteSelectedBlock);

    // ── Settings modal ────────────────────────────────────────────────────────
    const settingsModal = document.getElementById('settings-modal');
    const openSettings  = () => settingsModal?.classList.add('open');
    const closeSettings = () => settingsModal?.classList.remove('open');

    document.getElementById('btn-settings').addEventListener('click', openSettings);
    document.getElementById('settings-close-btn').addEventListener('click', closeSettings);
    settingsModal?.addEventListener('click', e => { if (e.target === settingsModal) closeSettings(); });

    document.getElementById('btn-pick-client').addEventListener('click', pickClientDir);
    document.getElementById('btn-clear-client').addEventListener('click', clearClientDir);
    document.getElementById('btn-pick-translation').addEventListener('click', pickTranslationDir);
    document.getElementById('btn-clear-translation').addEventListener('click', clearTranslationDir);

    // Populate language selects
    const langOpts = AVAILABLE_LANGS.map(l =>
        `<option value="${escAttr(l.code)}">${escHtml(l.label)}</option>`).join('');
    document.getElementById('tb-lang-select').innerHTML = langOpts;
    document.getElementById('settings-lang-select').innerHTML = langOpts;

    const onLangChange = async val => {
        _selectedLang = val;
        localStorage.setItem('ddon-lang', val);
        document.getElementById('tb-lang-select').value = val;
        document.getElementById('settings-lang-select').value = val;
        if (_translationHandle) {
            _msgMap = null;
            await loadTranslations();
        }
        // Re-render the prop panel so NPC names and tKey() calls pick up the new language
        if (_quest) renderPropPanel();
    };
    document.getElementById('tb-lang-select').addEventListener('change', e => onLangChange(e.target.value));
    document.getElementById('settings-lang-select').addEventListener('change', e => onLangChange(e.target.value));

    updateSettingsUI();
    tryRestoreDirectoryHandles();

    // Meta modal buttons
    document.getElementById('meta-close-btn').addEventListener('click',  closeMeta);
    document.getElementById('meta-cancel-btn').addEventListener('click', closeMeta);
    document.getElementById('meta-apply-btn').addEventListener('click',  applyMeta);
    document.getElementById('meta-modal').addEventListener('click', e => {
        if (e.target === document.getElementById('meta-modal')) closeMeta();
    });

    // Populate meta dropdowns
    populateMetaDropdowns();

    // Hide hint bar after 5s
    setTimeout(() => hintBar.classList.add('hidden'), 5000);

    // Restore last session — always from LS_CLEAN_QUEST (last saved/loaded state)
    // so a reload always shows the disk version, not unsaved edits.
    const cleanJson = localStorage.getItem(LS_CLEAN_QUEST);
    const dirtyJson = localStorage.getItem(LS_QUEST);
    const savedCam  = localStorage.getItem(LS_CAM);
    if (cleanJson) {
        try {
            _quest     = normalizeQuest(JSON.parse(cleanJson));
            _cleanJson = cleanJson;
            if (savedCam) { _cam = JSON.parse(savedCam); applyCamera(); } else { resetCamera(); }
            loadAuxViewers();
            render();
            enableQuestUI();
            updateDirtyUI();
            // If the previous session had unsaved edits, offer to restore them
            if (dirtyJson && localStorage.getItem(LS_DIRTY) === '1') {
                showUnsavedBanner(dirtyJson);
            }
        } catch (_) { /* corrupt — ignore */ }
    }

    // Async: try to re-read the actual file from disk via stored handle (File System Access API)
    if (window.showOpenFilePicker) {
        idbGet('fileHandle').then(handle => {
            if (!handle) return;
            _fileHandle = handle;
            return handle.queryPermission({ mode: 'read' }).then(perm => {
                if (perm === 'granted') {
                    return handle.getFile().then(f => f.text()).then(text => {
                        loadQuestJson(text, handle.name);
                        const cam = localStorage.getItem(LS_CAM);
                        if (cam) { try { _cam = JSON.parse(cam); applyCamera(); } catch (_) {} }
                        hideUnsavedBanner(); // disk re-read supersedes the unsaved recovery offer
                        maybeAutoLoadSourceFiles().catch(() => {});
                    });
                }
                showReloadBtn(true); // perm === 'prompt' — user must click to re-read
            });
        }).catch(() => {});
    }
}

function populateMetaDropdowns() {
    const typeSelect = document.getElementById('m-type');
    QUEST_TYPES.forEach(t => {
        const o = document.createElement('option');
        o.value = t; o.textContent = t;
        typeSelect.appendChild(o);
    });
    const areaSelect = document.getElementById('m-area-id');
    AREA_IDS.forEach(([val, label]) => {
        const o = document.createElement('option');
        o.value = val; o.textContent = label;
        areaSelect.appendChild(o);
    });
}

// ── Dirty tracking ────────────────────────────────────────────────────────────
function isDirty() {
    return _quest != null && JSON.stringify(_quest) !== _cleanJson;
}

function markClean() {
    _cleanJson = _quest ? JSON.stringify(_quest) : null;
    if (_cleanJson) {
        try {
            localStorage.setItem(LS_CLEAN_QUEST, _cleanJson);
            localStorage.setItem(LS_DIRTY, '0');
        } catch (_) {}
    }
    updateDirtyUI();
}

function updateDirtyUI() {
    const saveBtn = document.getElementById('btn-save');
    if (!saveBtn) return;
    if (isDirty()) {
        saveBtn.classList.add('dirty');
        saveBtn.textContent = '💾 Save JSON *';
    } else {
        saveBtn.classList.remove('dirty');
        saveBtn.textContent = '💾 Save JSON';
    }
}

function confirmIfDirty(msg = 'You have unsaved changes. Continue anyway?') {
    return !isDirty() || confirm(msg);
}

// ── IndexedDB helpers (for persisting FileSystemFileHandle) ───────────────────
function idbOpen() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE);
        req.onsuccess = e => resolve(e.target.result);
        req.onerror   = () => reject(req.error);
    });
}

async function idbPut(key, value) {
    try {
        const db = await idbOpen();
        db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).put(value, key);
    } catch (_) {}
}

async function idbGet(key) {
    try {
        const db = await idbOpen();
        return await new Promise((resolve, reject) => {
            const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror   = () => reject(req.error);
        });
    } catch (_) { return null; }
}

// ── Panel state persistence (position, size, pinned) ─────────────────────────
function getPanelState(fname) {
    try { return JSON.parse(localStorage.getItem(LS_PANEL_STATES) ?? '{}')[fname] ?? null; }
    catch (_) { return null; }
}
function savePanelState(fname, panel, extra = {}) {
    try {
        const all = JSON.parse(localStorage.getItem(LS_PANEL_STATES) ?? '{}');
        all[fname] = {
            x: parseFloat(panel.style.left),
            y: parseFloat(panel.style.top),
            w: panel.offsetWidth,
            h: panel.offsetHeight,
            pinned: panel.classList.contains('src-detail-pinned'),
            ...extra,
        };
        localStorage.setItem(LS_PANEL_STATES, JSON.stringify(all));
    } catch (_) {}
}
function clearPanelState(fname) {
    try {
        const all = JSON.parse(localStorage.getItem(LS_PANEL_STATES) ?? '{}');
        delete all[fname];
        localStorage.setItem(LS_PANEL_STATES, JSON.stringify(all));
    } catch (_) {}
}

// ── Directory handles + settings ──────────────────────────────────────────────
const AVAILABLE_LANGS = [
    { code: 'English',              label: 'EN — English' },
    { code: 'Spanish',              label: 'ES — Spanish' },
    { code: 'Viet',                 label: 'VI — Vietnamese' },
    { code: 'Portuguese (Brazil)',  label: 'PT — Portuguese (Brazil)' },
    { code: 'Traditional Chinese',  label: 'ZH — Traditional Chinese' },
];

function updateSettingsUI() {
    const cp = document.getElementById('client-path-display');
    const tp = document.getElementById('translation-path-display');
    if (cp) {
        cp.textContent = _clientHandle ? _clientHandle.name : 'Not configured';
        cp.classList.toggle('configured', !!_clientHandle);
    }
    if (tp) {
        tp.textContent = _translationHandle ? _translationHandle.name : 'Not configured';
        tp.classList.toggle('configured', !!_translationHandle);
    }
    // Toolbar lang select
    const tls = document.getElementById('tb-lang-select');
    if (tls) tls.value = _selectedLang;
    const sls = document.getElementById('settings-lang-select');
    if (sls) sls.value = _selectedLang;
}

function setTranslationStatus(msg, isErr = false) {
    const el = document.getElementById('translation-status');
    if (el) { el.textContent = msg; el.style.color = isErr ? 'var(--danger)' : 'var(--text2)'; }
}

async function tryRestoreDirectoryHandles() {
    if (!window.showDirectoryPicker) return;
    for (const [idbKey, setter] of [
        ['clientDirHandle',      h => _clientHandle = h],
        ['translationDirHandle', h => _translationHandle = h],
    ]) {
        try {
            const h = await idbGet(idbKey);
            if (!h) continue;
            const perm = await h.queryPermission({ mode: 'read' });
            if (perm === 'granted') setter(h);
            else {
                // requestPermission needs a user gesture — skip silently, user can re-browse
            }
        } catch (_) {}
    }
    updateSettingsUI();
    syncSourceFilesCard();
    if (_translationHandle) loadTranslations().catch(() => {});
    maybeAutoLoadSourceFiles().catch(() => {});
}

async function pickClientDir() {
    if (!window.showDirectoryPicker) { alert('File System Access API not supported in this browser.'); return; }
    try {
        const h = await window.showDirectoryPicker({ mode: 'read' });
        _clientHandle = h;
        _auxQuestIndex = null;
        _auxQuestNames = new Map();
        await idbPut('clientDirHandle', h);
        updateSettingsUI();
        syncSourceFilesCard();
    } catch (_) {}
}

async function clearClientDir() {
    _clientHandle = null;
    _loadedSourceFiles = null;
    _mssGroupMap = null;
    _auxQuestIndex = null;
    _auxQuestNames = new Map();
    try { const db = await idbOpen(); db.transaction(IDB_STORE,'readwrite').objectStore(IDB_STORE).delete('clientDirHandle'); } catch (_) {}
    updateSettingsUI();
    syncSourceFilesCard();
}

async function pickTranslationDir() {
    if (!window.showDirectoryPicker) { alert('File System Access API not supported in this browser.'); return; }
    try {
        const h = await window.showDirectoryPicker({ mode: 'read' });
        _translationHandle = h;
        await idbPut('translationDirHandle', h);
        updateSettingsUI();
        await loadTranslations();
    } catch (_) {}
}

async function clearTranslationDir() {
    _translationHandle = null;
    _msgMap = null;
    try { const db = await idbOpen(); db.transaction(IDB_STORE,'readwrite').objectStore(IDB_STORE).delete('translationDirHandle'); } catch (_) {}
    updateSettingsUI();
    setTranslationStatus('');
}

// ── Translation loader ─────────────────────────────────────────────────────────
function parseCsvLine(line) {
    const fields = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
            else inQ = !inQ;
        } else if (c === ',' && !inQ) { fields.push(cur); cur = ''; }
        else cur += c;
    }
    fields.push(cur);
    return fields;
}

async function readFileFromHandle(dirHandle, ...parts) {
    let cur = dirHandle;
    try {
        for (let i = 0; i < parts.length - 1; i++)
            cur = await cur.getDirectoryHandle(parts[i]);
        const fh = await cur.getFileHandle(parts[parts.length - 1]);
        return await (await fh.getFile()).text();
    } catch (_) { return null; }
}

async function loadTranslations() {
    if (!_translationHandle) return;
    setTranslationStatus('Loading gmd.csv…');
    const masterText = await readFileFromHandle(_translationHandle, 'gmd.csv');
    if (!masterText) { setTranslationStatus('gmd.csv not found in selected directory', true); return; }

    const map = new Map();
    // gmdNpcByEn: lowercase EN name → {jp, en} — built from npc_name.gmd rows
    const gmdNpcByEn = new Map();
    for (const line of masterText.split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const f = parseCsvLine(t);
        if (f.length < 4) continue;
        const [, key, jp, en] = f;
        if (key && !map.has(key)) map.set(key, { jp, en });
        // Collect NPC names: col[4] contains the gmd path
        if (f[4] && f[4].includes('npc_name.gmd') && en && !gmdNpcByEn.has(en.toLowerCase())) {
            gmdNpcByEn.set(en.toLowerCase(), { jp, en });
        }
    }

    // Build _npcNameMap: npcId string → {en, jp} by matching npcNames against gmd by EN name
    const npcMap = new Map();
    for (const [id, enName] of Object.entries(npcNames)) {
        const gmdEntry = gmdNpcByEn.get(enName.toLowerCase());
        npcMap.set(id, { en: enName, jp: gmdEntry?.jp ?? null });
    }

    if (_selectedLang !== 'English') {
        const langText = await readFileFromHandle(_translationHandle, _selectedLang, 'gmd.csv');
        if (langText) {
            const gmdNpcLangByEn = new Map();
            for (const line of langText.split('\n')) {
                const t = line.trim();
                if (!t || t.startsWith('#')) continue;
                const f = parseCsvLine(t);
                if (f.length < 4) continue;
                const [, key, , langMsg] = f;
                if (key && langMsg) {
                    const e = map.get(key);
                    if (e) e.lang = langMsg;
                }
                // Collect translated NPC names: lang file col[3] is the translation,
                // col[2] is JP — look up the master EN name via gmdNpcByEn reverse match
                if (f[4] && f[4].includes('npc_name.gmd') && langMsg) {
                    // Use JP name to find the master EN name (JP is same across all lang files)
                    const jpName = f[2];
                    if (jpName) {
                        for (const [enKey, gEntry] of gmdNpcByEn) {
                            if (gEntry.jp === jpName) { gmdNpcLangByEn.set(enKey, langMsg); break; }
                        }
                    }
                }
            }
            // Overlay translated NPC names
            for (const [, entry] of npcMap) {
                const translated = gmdNpcLangByEn.get(entry.en.toLowerCase());
                if (translated) entry.lang = translated;
            }
        }
    }

    _msgMap = map;
    _npcNameMap = npcMap;
    setTranslationStatus(`${map.size.toLocaleString()} messages loaded`);
}

// Look up a message key → { primary, jp } or null
function tKey(key) {
    if (!_msgMap || !key) return null;
    const e = _msgMap.get(key);
    if (!e) return null;
    const primary = (_selectedLang !== 'English' && e.lang) ? e.lang : (e.en || null);
    return { primary, jp: e.jp || null };
}

// ── Client source file reader ──────────────────────────────────────────────────
async function readQuestSourceFiles(questId) {
    if (!_clientHandle || !questId) return null;
    const id = String(questId);
    const padded = id.padStart(8, '0');

    // Navigate to quest/q{padded} root (try padded then raw id)
    async function getQuestRoot(qKey) {
        try {
            let d = _clientHandle;
            d = await d.getDirectoryHandle('quest');
            d = await d.getDirectoryHandle(qKey);
            return d;
        } catch (_) { return null; }
    }
    const questRoot = (await getQuestRoot(`q${padded}`)) || (await getQuestRoot(`q${id}`));
    if (!questRoot) return null;

    const files = {};

    async function readDir(d, prefix) {
        for await (const [name, entry] of d.entries()) {
            if (entry.kind === 'file' && name.endsWith('.json')) {
                try { files[prefix + name] = JSON.parse(await (await entry.getFile()).text()); } catch (_) {}
            } else if (entry.kind === 'directory') {
                try { await readDir(await d.getDirectoryHandle(name), `${prefix}${name}/`); } catch (_) {}
            }
        }
    }

    // Read the quest data subtree (quest/{padded}/)
    try {
        let qd = await questRoot.getDirectoryHandle('quest');
        qd = await qd.getDirectoryHandle(padded);
        await readDir(qd, 'quest/');
    } catch (_) {}

    // Read the ui subtree (ui/)
    try {
        const uid = await questRoot.getDirectoryHandle('ui');
        await readDir(uid, 'ui/');
    } catch (_) {}

    return Object.keys(files).length ? files : null;
}

function buildSourceHtml(files) {
    const KIND_LABELS  = { 0:'Enemy', 1:'NPC', 2:'OM', 3:'OmWarp', 4:'Lot', 5:'Gimmick' };
    const KIND_ICONS   = { 0:'⚔', 1:'🧑', 2:'◎', 3:'⬡', 4:'🎲', 5:'🔧' };

    function fmtPos(pos) {
        if (!pos) return '';
        return `${Math.round(pos.X)}, ${Math.round(pos.Y)}, ${Math.round(pos.Z)}`;
    }

    function renderQst(data) {
        let h = '';
        for (const stage of (data.QuestStageList ?? [])) {
            for (const grp of (stage.QuestGrp ?? [])) {
                h += `<div class="source-grp">
                    <div class="source-grp-hdr">
                        Group ${grp.GroupNo ?? '?'}
                        ${grp.Condition != null ? `<span class="source-meta">cond:${grp.Condition}</span>` : ''}
                        ${grp.Comment    ? `<span class="source-meta source-jp">${escHtml(grp.Comment)}</span>` : ''}
                    </div>`;
                for (const set of (grp.QuestSet ?? [])) {
                    const kind  = KIND_LABELS[set.Kind] ?? `Kind${set.Kind}`;
                    const icon  = KIND_ICONS[set.Kind]  ?? '•';
                    const info  = set.SetInfo ?? {};
                    const npcEn  = info.NpcName?.En ?? '';
                    const npcJp  = info.NpcName?.Jp ?? '';
                    const npcId  = info.NpcId != null ? info.NpcId : null;
                    const pos    = info.InfoCharacter?.Position ?? info.Position ?? null;
                    const fsm    = info.FsmResource?.Fsmname ?? '';
                    const talkId = info.TalkStateId != null ? `talk:${info.TalkStateId}` : '';
                    const unitNo = set.UnitNo != null ? `unit:${set.UnitNo}` : '';
                    h += `<div class="source-set">
                        <span class="source-set-kind">${icon} ${escHtml(kind)}</span>
                        ${unitNo ? `<span class="source-meta">${escHtml(unitNo)}</span>` : ''}
                        ${set.Comment ? `<span class="source-jp">${escHtml(set.Comment)}</span>` : ''}
                        ${npcEn ? `<span class="source-detail">${escHtml(npcEn)}${npcJp ? ` <span class="source-jp">${escHtml(npcJp)}</span>` : ''}${npcId != null ? ` <span class="source-meta">id:${npcId}</span>` : ''}</span>` : ''}
                        ${pos   ? `<span class="source-meta">📍 ${fmtPos(pos)}</span>` : ''}
                        ${talkId ? `<span class="source-meta">${escHtml(talkId)}</span>` : ''}
                        ${fsm   ? `<span class="source-meta">fsm: ${escHtml(fsm.split('\\').pop())}</span>` : ''}
                    </div>`;
                }
                h += `</div>`;
            }
        }
        return h || '<span class="source-meta">No stage data</span>';
    }

    function renderQmi(data) {
        const stage = data.StageName?.En ? `${escHtml(data.StageName.En)} (st${String(data.StageNo).padStart(4,'0')})` : '';
        let h = stage ? `<div class="source-grp-hdr">${stage}</div>` : '';
        for (const info of (data.InfoList ?? [])) {
            h += `<div class="source-set">
                <span class="source-set-kind">📍 Group ${info.GroupNo ?? '?'}</span>
                <span class="source-meta">${fmtPos(info.Pos)}</span>
                ${info.UniqueId != null ? `<span class="source-meta">uid:${info.UniqueId}</span>` : ''}
            </div>`;
        }
        return h || '<span class="source-meta">No markers</span>';
    }

    function renderFsm(data) {
        const states = data.StateList ?? [];
        if (!states.length) return `<span class="source-meta">No states</span>`;
        let h = '';
        for (const st of states) {
            const name = st.Name?.Id != null ? `State ${st.Name.Id}` : 'State';
            h += `<div class="source-set"><span class="source-set-kind">⚙ ${escHtml(name)}</span></div>`;
        }
        return h;
    }

    function renderGmd(data) {
        const indices = data.Indices ?? [];
        if (!indices.length) return `<span class="source-meta">No messages</span>`;
        let h = '';
        for (const entry of indices) {
            const idx = entry.MessageIndex ?? '?';
            const msg = entry.Message ?? '';
            h += `<div class="source-set">
                <span class="source-set-kind">#${idx}</span>
                <span class="source-detail">${escHtml(msg)}</span>
            </div>`;
        }
        return h;
    }

    function renderQtd(data) {
        const list = data.QuestTextDataList ?? [];
        if (!list.length) return `<span class="source-meta">No text entries</span>`;
        const TYPE_LABELS = {
            'QUEST_TEXT_TYPE_NAME': 'Name',
            'QUEST_TEXT_TYPE_ORDER': 'Order',
            'QUEST_TEXT_TYPE_PURPOSE': 'Purpose',
        };
        let h = '';
        for (const entry of list) {
            const label = TYPE_LABELS[entry.TypeName] ?? entry.TypeName ?? `Type${entry.Type}`;
            const en = entry.Message?.En ?? '';
            const jp = entry.Message?.Jp ?? '';
            h += `<div class="source-set">
                <span class="source-set-kind">${escHtml(label)}</span>
                ${en ? `<span class="source-detail">${escHtml(en)}${jp ? ` <span class="source-jp">${escHtml(jp)}</span>` : ''}</span>` : ''}
            </div>`;
        }
        return h;
    }

    function renderMss(data) {
        const groups = data.NativeMsgGroupArray ?? [];
        if (!groups.length) return `<span class="source-meta">No NPC dialogue</span>`;
        let h = '';
        for (const grp of groups) {
            const npcName  = grp.NpcName?.En ?? grp.NpcName?.Jp ?? `NPC ${grp.NpcId ?? '?'}`;
            const npcIdStr = grp.NpcId != null ? ` #${grp.NpcId}` : '';
            const serial   = grp.GroupSerial != null ? `serial:${grp.GroupSerial}` : '';
            h += `<div class="source-grp">
                <div class="source-grp-hdr">
                    🧑 ${escHtml(npcName)}${escHtml(npcIdStr)}
                    ${serial ? `<span class="source-meta">${escHtml(serial)}</span>` : ''}
                </div>`;
            for (const msg of (grp.MsgData ?? [])) {
                const en = msg.Message?.En ?? '';
                const jp = msg.Message?.Jp ?? '';
                const gmdIdx = msg.GmdIndex != null ? `#${msg.GmdIndex}` : '';
                h += `<div class="source-set">
                    ${gmdIdx ? `<span class="source-set-kind">${gmdIdx}</span>` : ''}
                    ${en ? `<span class="source-detail">${escHtml(en)}${jp ? ` <span class="source-jp">${escHtml(jp)}</span>` : ''}</span>` : ''}
                </div>`;
            }
            h += `</div>`;
        }
        return h;
    }

    function renderGeneric(data) {
        // Show top-level keys with their types/counts
        return Object.entries(data)
            .filter(([k]) => !k.startsWith('@') && k !== 'FileHeader')
            .map(([k, v]) => {
                const summary = Array.isArray(v) ? `[${v.length}]` : typeof v === 'object' && v ? '{…}' : escHtml(String(v));
                return `<div class="source-set"><span class="source-set-kind">${escHtml(k)}</span><span class="source-meta">${summary}</span></div>`;
            }).join('') || '<span class="source-meta">Empty</span>';
    }

    let html = `<div class="source-viewer">`;
    for (const [fname, data] of Object.entries(files).sort(([a],[b]) => a.localeCompare(b))) {
        let body;
        if      (fname.includes('.qst.'))  body = renderQst(data);
        else if (fname.includes('.qmi.') || fname.includes('.fmi.')) body = renderQmi(data);
        else if (fname.includes('.fsm.'))  body = renderFsm(data);
        else if (fname.includes('.gmd.'))  body = renderGmd(data);
        else if (fname.includes('.qtd.'))  body = renderQtd(data);
        else if (fname.includes('.mss.'))  body = renderMss(data);
        else                               body = renderGeneric(data);

        html += `<div class="source-file-block">
            <div class="source-file-name">
                <span>${escHtml(fname)}</span>
                <button class="source-copy-btn" data-copy-target="${escAttr(fname)}">Copy</button>
            </div>
            ${body}
        </div>`;
    }
    html += `</div>`;
    return html;
}

// ── File System Access API ────────────────────────────────────────────────────
async function openQuestFile() {
    if (!confirmIfDirty()) return;
    if (!window.showOpenFilePicker) { fileInput.click(); return; }
    try {
        const [handle] = await window.showOpenFilePicker({
            types: [{ description: 'Quest JSON', accept: { 'application/json': ['.json'] } }],
            multiple: false,
        });
        _fileHandle = handle;
        await idbPut('fileHandle', handle);
        const file = await handle.getFile();
        loadQuestJson(await file.text(), handle.name);
    } catch (err) {
        if (err.name !== 'AbortError') alert(`Error opening file: ${err.message}`);
    }
}

async function reloadFromDisk() {
    if (!confirmIfDirty('Reload from disk? Unsaved changes will be lost.')) return;
    if (!window.showOpenFilePicker) {
        // No File System Access API — fall back to regular file open
        fileInput.click();
        return;
    }
    try {
        // If we already have a handle, re-read it directly
        if (_fileHandle) {
            let perm = await _fileHandle.queryPermission({ mode: 'read' });
            if (perm === 'prompt') perm = await _fileHandle.requestPermission({ mode: 'read' });
            if (perm === 'granted') {
                const file = await _fileHandle.getFile();
                loadQuestJson(await file.text(), _fileHandle.name);
                return;
            }
        }
        // No handle yet (or permission lost) — open picker to pick/re-pick the file
        const [handle] = await window.showOpenFilePicker({
            types: [{ description: 'Quest JSON', accept: { 'application/json': ['.json'] } }],
            multiple: false,
        });
        _fileHandle = handle;
        await idbPut('fileHandle', handle);
        const file = await handle.getFile();
        loadQuestJson(await file.text(), handle.name);
    } catch (err) {
        if (err.name !== 'AbortError') alert(`Error reloading file: ${err.message}`);
    }
}

function showReloadBtn(visible) {
    const btn = document.getElementById('btn-reload-disk');
    if (btn) btn.style.display = visible ? '' : 'none';
}

function showUnsavedBanner(dirtyJson) {
    const bar = document.getElementById('unsaved-bar');
    if (!bar) return;
    bar.style.display = 'flex';
    document.getElementById('btn-restore-unsaved').onclick = () => {
        try {
            const q = JSON.parse(dirtyJson);
            _quest = normalizeQuest(q);
            _selection = null;
            render();
            renderPropPanel();
            // Don't call markClean — these are still unsaved edits
            persistQuest();
            updateDirtyUI();
        } catch (_) {}
        hideUnsavedBanner();
    };
    document.getElementById('btn-discard-unsaved').onclick = () => {
        // Reset dirty flag and sync working copy back to the clean version
        try {
            localStorage.setItem(LS_DIRTY, '0');
            if (_cleanJson) localStorage.setItem(LS_QUEST, _cleanJson);
        } catch (_) {}
        hideUnsavedBanner();
    };
}

function hideUnsavedBanner() {
    const bar = document.getElementById('unsaved-bar');
    if (bar) bar.style.display = 'none';
}

// ── Quest loading ─────────────────────────────────────────────────────────────
function persistQuest() {
    if (!_quest) return;
    const json = JSON.stringify(_quest);
    try {
        localStorage.setItem(LS_QUEST, json);
        if (json !== _cleanJson) localStorage.setItem(LS_DIRTY, '1');
    } catch (_) {}
    updateDirtyUI();
}

function persistCam() {
    try { localStorage.setItem(LS_CAM, JSON.stringify(_cam)); } catch (_) {}
}

// ── Prop panel resize ─────────────────────────────────────────────────────────
function initPropResize() {
    const panel  = document.getElementById('prop-panel');
    const handle = document.getElementById('prop-resize-handle');

    // Restore saved width
    const saved = localStorage.getItem(LS_PROP_W);
    if (saved) panel.style.width = `${parseInt(saved)}px`;

    let startX, startW;

    handle.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        startX = e.clientX;
        startW = panel.getBoundingClientRect().width;
        handle.classList.add('dragging');
        document.body.style.cursor = 'ew-resize';
        e.preventDefault();
    });

    window.addEventListener('mousemove', e => {
        if (!handle.classList.contains('dragging')) return;
        // Dragging left increases width (panel is on the right)
        const delta = startX - e.clientX;
        const newW  = Math.min(600, Math.max(200, startW + delta));
        panel.style.width = `${newW}px`;
    });

    window.addEventListener('mouseup', () => {
        if (!handle.classList.contains('dragging')) return;
        handle.classList.remove('dragging');
        document.body.style.cursor = '';
        const w = parseInt(panel.getBoundingClientRect().width);
        try { localStorage.setItem(LS_PROP_W, w); } catch (_) {}
    });
}

function loadQuestJson(text) {
    try {
        const data = JSON.parse(text);
        _quest = normalizeQuest(data);
        _selection = null;
        _focusedProc = null;
        loadAuxViewers();
        resetCamera();
        render();
        enableQuestUI();
        markClean();
        persistQuest();
        if (window.showOpenFilePicker) showReloadBtn(true);
        maybeAutoLoadSourceFiles().catch(() => {});
    } catch (err) {
        alert(`Failed to parse JSON: ${err.message}`);
    }
}

function normalizeQuest(data) {
    // Support both flat `blocks` (single process) and `processes` array
    const q = Object.assign({}, data);
    if (!q.processes) {
        q.processes = [{ comment: 'process 0', blocks: q.blocks || [] }];
        delete q.blocks;
    }
    q.processes = q.processes.map((p, i) => ({
        comment: p.comment ?? `process ${i}`,
        blocks: (p.blocks || []).map(normalizeBlock),
    }));
    // Ensure substory image fields have defaults so the meta card renders correctly on load
    if (q.type === 'Substory') {
        if (q.substory_group_id == null) q.substory_group_id = SUBSTORY_GROUPS[0].id;
        if (q.substory_sequence_num == null) {
            const grp = SUBSTORY_GROUPS.find(g => g.id === q.substory_group_id) ?? SUBSTORY_GROUPS[0];
            q.substory_sequence_num = grp.seqs[0] ?? 0;
        }
    }
    return q;
}

function normalizeBlock(b) {
    const blk = Object.assign({}, b);
    if (!blk.type) blk.type = 'Raw';
    if (!blk.flags) blk.flags = [];
    // check_commands / result_commands may or may not be present
    return blk;
}

function enableQuestUI() {
    document.getElementById('btn-save').disabled    = false;
    document.getElementById('btn-save-as').disabled = false;
    document.getElementById('btn-add-process').disabled = false;

    // Toolbar display
    questIdDisplay.textContent      = `Quest ${_quest.quest_id ?? '???'}`;
    questVariantDisplay.textContent = `v${_quest.variant_index ?? 0}`;
    questTitleDisplay.textContent   = _quest.comment ?? '';
}

async function loadFromUrl() {
    if (!confirmIfDirty()) return;
    const url = prompt('Enter quest JSON URL:');
    if (!url) return;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        loadQuestJson(text, url.split('/').pop());
    } catch (err) {
        alert(`Failed to load: ${err.message}`);
    }
}

// ── New quest ─────────────────────────────────────────────────────────────────
function newQuest() {
    if (!confirmIfDirty()) return;
    _fileHandle = null;
    showReloadBtn(false);
    _quest = {
        state_machine: 'GenericStateMachine',
        type: 'World',
        comment: 'New Quest',
        quest_id: 0,
        base_level: 1,
        minimum_item_rank: 0,
        discoverable: true,
        area_id: 'HidellPlains',
        news_image: 0,
        rewards: [],
        processes: [
            { comment: 'process 0', blocks: [] },
        ],
    };
    _selection = null;
    resetCamera();
    render();
    enableQuestUI();
    markClean();
    persistQuest();
}

// ── Save quest ────────────────────────────────────────────────────────────────

// Returns a deep copy of the quest with all implied defaults filled in explicitly.
// Returns the implied default for enable_cancel based on quest type.
// World / WildHunt / Board → true; ExtremeMission / Cycle* → false (not cancelable);
// everything else → false.
function defaultEnableCancel(type) {
    if (['World', 'WildHunt', 'Board'].includes(type)) return true;
    return false;
}

// Returns whether enable_cancel is relevant for this quest type.
// ExtremeMission / CycleContents / CycleContentsQuest are accepted differently — no cancel.
function isCancelApplicable(type) {
    return !['ExtremeMission', 'CycleContents', 'CycleContentsQuest', 'WorldManage'].includes(type);
}

function normalizeForSave(q) {
    const out = JSON.parse(JSON.stringify(q));

    // Quest-level defaults
    out.variant_index       = out.variant_index       ?? 0;
    out.minimum_item_rank   = out.minimum_item_rank   ?? 0;
    out.enabled             = out.enabled             ?? true;
    out.discoverable        = out.discoverable        ?? true;
    // enable_cancel: write explicit value based on type default
    if (out.enable_cancel === undefined) {
        if (isCancelApplicable(out.type)) {
            out.enable_cancel = defaultEnableCancel(out.type);
        }
        // For non-applicable types, omit entirely (no field written)
    }

    // Order conditions — fill in default param values (0) for any params not yet touched
    for (const oc of (out.order_conditions ?? [])) {
        const params = OC_PARAMS[oc.type] || [];
        params.forEach((_, pi) => {
            const pk = pi === 0 ? 'Param1' : 'Param2';
            if (oc[pk] === undefined) oc[pk] = 0;
        });
    }

    for (const proc of (out.processes ?? [])) {
        for (const block of (proc.blocks ?? [])) {
            // Checkpoint is always explicit
            block.checkpoint = block.checkpoint ?? false;

            // reset_group is explicit on all block types that declare it
            const info = blockTypeInfo(block.type);
            if (info.fields.includes('reset_group')) {
                block.reset_group = block.reset_group ?? false;
            }

            // stage_id.layer_no always explicit
            if (block.stage_id) {
                block.stage_id.layer_no = block.stage_id.layer_no ?? 0;
            }
        }
    }

    return out;
}

async function saveQuest() {
    if (!_quest) return;
    if (!_fileHandle) { await saveQuestAs(); return; }
    const out = JSON.stringify(normalizeForSave(_quest), null, 2);
    try {
        const writable = await _fileHandle.createWritable();
        await writable.write(out);
        await writable.close();
        markClean();
    } catch (err) {
        if (err.name !== 'AbortError') console.error('Save failed:', err);
    }
}

async function saveQuestAs() {
    if (!_quest) return;
    const out  = JSON.stringify(normalizeForSave(_quest), null, 2);
    const qid  = _quest.quest_id != null ? String(_quest.quest_id).padStart(8, '0') : '00000000';
    const vid  = _quest.variant_index ?? 0;
    const name = `q${qid}_${vid}.json`;
    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: name,
                types: [{ description: 'Quest JSON', accept: { 'application/json': ['.json'] } }],
            });
            const writable = await handle.createWritable();
            await writable.write(out);
            await writable.close();
            _fileHandle = handle;
            await idbPut('fileHandle', handle);
            markClean();
        } catch (err) {
            if (err.name !== 'AbortError') console.error('Save As failed:', err);
        }
    } else {
        // Fallback: blob download
        const blob = new Blob([out], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = name; a.click();
        URL.revokeObjectURL(url);
        markClean();
    }
}

// ── Camera ────────────────────────────────────────────────────────────────────
function resetCamera() {
    _cam = { x: 40, y: 40, z: 1.0 };
    applyCamera();
}

function applyCamera() {
    world.style.transform = `translate(${_cam.x}px,${_cam.y}px) scale(${_cam.z})`;
    zoomDisplay.textContent = `${Math.round(_cam.z * 100)}%`;
    persistCam();
}

function onCanvasMouseDown(e) {
    if (e.button !== 0) return;
    // Spacebar held — pan from anywhere (including over panels)
    if (_spaceDown) {
        _isPanning = true;
        _panMoved  = false;
        _panStart  = { x: e.clientX, y: e.clientY, cx: _cam.x, cy: _cam.y };
        canvasWrap.classList.add('panning');
        e.preventDefault();
        return;
    }
    // Only start pan if clicking on canvas background (not a block)
    if (e.target !== canvasWrap && e.target !== world && !e.target.closest('.lane-body') &&
        !e.target.classList.contains('swimlane') && e.target.id !== 'canvas-empty') {
        // click was on a block node — let block click handler deal with it
        return;
    }
    _isPanning = true;
    _panMoved  = false;
    _panStart  = { x: e.clientX, y: e.clientY, cx: _cam.x, cy: _cam.y };
    canvasWrap.classList.add('panning');
}

const DRAG_THRESHOLD = 6; // px movement before drag activates

function onCanvasMouseMove(e) {
    // ── Drag ──────────────────────────────────────────────────────────────────
    if (_drag) {
        const dx = e.clientX - _drag.startX;
        const dy = e.clientY - _drag.startY;

        if (!_drag.live && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
            _drag.live = true;
            startDragGhost(e);
            canvasWrap.classList.add('dragging-block');
            world.classList.add('drag-active');
        }

        if (_drag.live) {
            moveDragGhost(e);
            updateDragTarget(e);
            return; // suppress pan while dragging
        }
        return;
    }

    // ── Pan ───────────────────────────────────────────────────────────────────
    if (!_isPanning) return;
    _cam.x = _panStart.cx + (e.clientX - _panStart.x);
    _cam.y = _panStart.cy + (e.clientY - _panStart.y);
    _panMoved = true;
    applyCamera();
}

function onCanvasMouseUp() {
    if (_drag) {
        if (_drag.live) commitDrop();
        cancelDrag();
        return;
    }
    if (_panMoved) {
        // Suppress the click that fires after mouseup so detail panels don't close
        _suppressNextDocClick = true;
        setTimeout(() => { _suppressNextDocClick = false; }, 0);
        _panMoved = false;
    }
    _isPanning = false;
    canvasWrap.classList.remove('panning');
}

// ── Drag helpers ──────────────────────────────────────────────────────────────

function startDragGhost(e) {
    // Build a lightweight ghost matching the dragged block node
    const srcEl = world.querySelector(`.block-node[data-proc="${_drag.srcProc}"][data-block="${_drag.srcBlock}"]`);
    if (!srcEl) return;

    const ghost = srcEl.cloneNode(true);
    ghost.id = 'drag-ghost';
    ghost.style.cssText =
        `position:fixed;pointer-events:none;z-index:9999;opacity:0.75;` +
        `width:${srcEl.offsetWidth}px;box-shadow:0 4px 24px #000a;` +
        `transform:rotate(2deg);transition:none;`;
    document.body.appendChild(ghost);
    _drag.ghost = ghost;

    // Mark source as dragging
    srcEl.classList.add('dragging');
    moveDragGhost(e);
}

function moveDragGhost(e) {
    if (!_drag.ghost) return;
    _drag.ghost.style.left = (e.clientX + 12) + 'px';
    _drag.ghost.style.top  = (e.clientY - 20) + 'px';
}

function updateDragTarget(e) {
    // Find which lane-body the cursor is geometrically inside.
    // elementFromPoint is unreliable here because block nodes, buttons, and
    // the drag ghost can all sit on top and prevent finding the lane body.
    let laneEl = null;
    for (const lane of world.querySelectorAll('.lane-body')) {
        const r = lane.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right &&
            e.clientY >= r.top  && e.clientY <= r.bottom) {
            laneEl = lane;
            break;
        }
    }
    const overProc = laneEl ? parseInt(laneEl.dataset.proc) : null;

    // Remove old placeholder
    removePlaceholder();

    if (overProc === null || !_quest) {
        _drag.overProc = null;
        _drag.insertAt = null;
        // Highlight nothing
        document.querySelectorAll('.lane-body.drag-over').forEach(el => el.classList.remove('drag-over'));
        return;
    }

    document.querySelectorAll('.lane-body.drag-over').forEach(el => el.classList.remove('drag-over'));
    laneEl.classList.add('drag-over');
    _drag.overProc = overProc;

    // Determine insertion index by comparing cursor x to block midpoints in this lane
    const blocks = world.querySelectorAll(`.block-node[data-proc="${overProc}"]`);
    let insertAt = _quest.processes[overProc].blocks.length; // default: end
    for (const bn of blocks) {
        const r = bn.getBoundingClientRect();
        if (e.clientX < r.left + r.width / 2) {
            insertAt = parseInt(bn.dataset.block);
            break;
        }
    }
    // Suppress no-op drop: inserting before or after the source block in the same process
    const sameProc = overProc === _drag.srcProc;
    const isNoOp   = sameProc && (insertAt === _drag.srcBlock || insertAt === _drag.srcBlock + 1);
    if (isNoOp) {
        _drag.insertAt = null;
        return;
    }

    _drag.insertAt = insertAt;

    // End-of-lane: highlight the ghost card
    const laneBlockCount = _quest.processes[overProc].blocks.length;
    if (insertAt === laneBlockCount) {
        const ghostCard = laneEl.querySelector('.block-node-ghost');
        if (ghostCard) ghostCard.classList.add('drop-target');
        return;
    }

    // Mid-lane: highlight the existing spacer button at that position in place.
    // Spacer buttons have data-after = insertAt - 1. Position 0 (before first
    // block) has no spacer, so fall back to a small injected marker there.
    if (insertAt > 0) {
        const btn = laneEl.querySelector(
            `.add-between-btn[data-proc="${overProc}"][data-after="${insertAt - 1}"]`);
        if (btn) btn.classList.add('drop-target');
        return;
    }

    // insertAt === 0: before the very first block — inject a slim marker
    const marker = document.createElement('div');
    marker.id = 'drag-placeholder';
    marker.style.cssText =
        `width:6px;align-self:stretch;border-radius:4px;flex-shrink:0;` +
        `background:#4a90d9;opacity:0.8;margin-right:4px;`;
    const firstBlock = laneEl.querySelector('.block-node[data-block="0"]');
    if (firstBlock) laneEl.insertBefore(marker, firstBlock);
    _drag.placeholder = marker;
}

function removePlaceholder() {
    if (_drag?.placeholder) {
        _drag.placeholder.remove();
        _drag.placeholder = null;
    }
    world.querySelectorAll('.drop-target')
         .forEach(el => el.classList.remove('drop-target'));
}

function commitDrop() {
    const { srcProc, srcBlock, overProc, insertAt } = _drag;
    if (overProc === null || insertAt === null) return;

    const sameProc = srcProc === overProc;
    // Adjust insertion index when moving within the same process past the source
    let targetIdx = insertAt;
    if (sameProc && insertAt > srcBlock) targetIdx--;
    if (sameProc && targetIdx === srcBlock) return; // no-op

    const [block] = _quest.processes[srcProc].blocks.splice(srcBlock, 1);
    _quest.processes[overProc].blocks.splice(targetIdx, 0, block);
    _selection = { proc: overProc, block: targetIdx };
    render(); renderPropPanel(); persistQuest();
}

function cancelDrag() {
    removePlaceholder();
    if (_drag?.ghost) _drag.ghost.remove();
    document.querySelectorAll('.lane-body.drag-over').forEach(el => el.classList.remove('drag-over'));
    const srcEl = world.querySelector(`.block-node[data-proc="${_drag?.srcProc}"][data-block="${_drag?.srcBlock}"]`);
    if (srcEl) srcEl.classList.remove('dragging');
    canvasWrap.classList.remove('dragging-block');
    world.classList.remove('drag-active');
    _drag = null;
}

function onCanvasWheel(e) {
    // Inside a scrollable panel: plain wheel scrolls, Ctrl+wheel zooms canvas.
    // Outside panels: plain wheel always zooms.
    const scrollEl = e.target.closest('.fsm-graph-scroll, .src-detail-body');
    if (scrollEl && !e.ctrlKey) return; // let browser scroll natively

    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZ   = Math.min(3, Math.max(0.2, _cam.z * factor));

    // Zoom toward mouse cursor
    const rect   = canvasWrap.getBoundingClientRect();
    const mx     = e.clientX - rect.left;
    const my     = e.clientY - rect.top;
    _cam.x = mx - (mx - _cam.x) * (newZ / _cam.z);
    _cam.y = my - (my - _cam.y) * (newZ / _cam.z);
    _cam.z = newZ;
    applyCamera();
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
    // Remove all children of world except the svg-layer
    Array.from(world.children).forEach(el => { if (el !== svgLayer) el.remove(); });
    // Clear SVG arrow paths (keep defs)
    while (svgLayer.children.length > 1) svgLayer.removeChild(svgLayer.lastChild);

    if (!_quest) {
        canvasEmpty.style.display = '';
        renderSidebar();
        return;
    }
    canvasEmpty.style.display = 'none';

    closeSourceFilesSpider();
    renderSidebar();
    renderMetaCard();
    renderSourceFilesCard();
    renderEnemyGroupsCard();
    renderSwimlanes();
    renderArrows();
    if (_selection?.enemyGroup != null) openEnemyGroupSpider(_selection.enemyGroup);
    renderAllAuxViewers();
}

function renderSidebar() {
    processList.innerHTML = '';
    const showAllBtn = document.getElementById('btn-show-all');
    if (!_quest) {
        procCount.textContent = '0';
        if (showAllBtn) showAllBtn.style.display = 'none';
        return;
    }
    if (showAllBtn) showAllBtn.style.display = _focusedProc != null ? '' : 'none';
    const procs = _quest.processes || [];
    procCount.textContent = procs.length;
    const colors = ['#4a90d9','#4caf50','#f5a623','#d96a4a','#9b59b6','#1abc9c','#e74c3c','#3498db'];
    procs.forEach((p, pi) => {
        const el = document.createElement('div');
        const isFocused = _focusedProc === pi;
        el.className = 'proc-item'
            + (_selection?.proc === pi && _selection?.block == null ? ' active' : '')
            + (isFocused ? ' focused' : '');
        el.dataset.proc = pi;

        const dot = document.createElement('div');
        dot.className = 'proc-item-dot';
        dot.style.background = colors[pi % colors.length];

        const label = document.createElement('span');
        label.className = 'proc-item-label';
        label.textContent = `Process ${pi}`;
        label.title = p.comment ? `${p.comment}\n(double-click to edit comment)` : 'Double-click to add comment';
        label.addEventListener('dblclick', e => {
            e.stopPropagation();
            const input = document.createElement('input');
            input.type = 'text';
            input.value = p.comment || '';
            input.placeholder = `process ${pi}`;
            input.className = 'proc-item-label-input';
            label.replaceWith(input);
            input.focus();
            input.select();
            const commit = () => {
                const v = input.value.trim();
                p.comment = v || `process ${pi}`;
                renderSidebar();
                // Also update the lane header comment span
                const laneHeader = world.querySelector(`.swimlane[data-proc="${pi}"] .lane-header`);
                if (laneHeader) {
                    let cmtSpan = laneHeader.querySelector('.lane-proc-comment');
                    if (p.comment) {
                        if (!cmtSpan) { cmtSpan = document.createElement('span'); cmtSpan.className = 'lane-proc-comment'; laneHeader.appendChild(cmtSpan); }
                        cmtSpan.textContent = p.comment;
                    } else { cmtSpan?.remove(); }
                }
                persistQuest();
            };
            input.addEventListener('blur', commit);
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter')  { input.blur(); }
                if (e.key === 'Escape') { input.value = p.comment || ''; input.blur(); }
            });
        });

        const count = document.createElement('span');
        count.className = 'proc-item-count';
        count.textContent = `${(p.blocks || []).length} blk`;

        // Drag handle
        const handle = document.createElement('span');
        handle.className = 'proc-drag-handle';
        handle.textContent = '⠿';
        handle.title = 'Drag to reorder';

        // Focus (isolate) button
        const btnFocus = document.createElement('button');
        btnFocus.className = 'proc-focus-btn';
        btnFocus.textContent = isFocused ? '⊙' : '◎';
        btnFocus.title = isFocused ? 'Show all processes' : 'Isolate this process';
        btnFocus.addEventListener('click', e => {
            e.stopPropagation();
            _focusedProc = isFocused ? null : pi;
            render(); renderPropPanel();
        });

        // Delete button
        const btnDel = document.createElement('button');
        btnDel.className = 'proc-del-btn';
        btnDel.textContent = '×';
        btnDel.title = 'Delete process';
        btnDel.addEventListener('click', e => { e.stopPropagation(); deleteProcess(pi); });

        el.appendChild(handle);
        el.appendChild(dot);
        el.appendChild(label);
        el.appendChild(count);
        el.appendChild(btnFocus);
        el.appendChild(btnDel);

        // HTML5 drag
        el.draggable = true;
        el.addEventListener('dragstart', e => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', pi);
            el.classList.add('proc-dragging');
        });
        el.addEventListener('dragend', () => {
            el.classList.remove('proc-dragging');
            processList.querySelectorAll('.proc-drop-above,.proc-drop-below')
                .forEach(n => n.classList.remove('proc-drop-above','proc-drop-below'));
        });
        el.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            processList.querySelectorAll('.proc-drop-above,.proc-drop-below')
                .forEach(n => n.classList.remove('proc-drop-above','proc-drop-below'));
            const r = el.getBoundingClientRect();
            if (e.clientY < r.top + r.height / 2) el.classList.add('proc-drop-above');
            else el.classList.add('proc-drop-below');
        });
        el.addEventListener('dragleave', () => {
            el.classList.remove('proc-drop-above','proc-drop-below');
        });
        el.addEventListener('drop', e => {
            e.preventDefault();
            const srcPi = parseInt(e.dataTransfer.getData('text/plain'));
            const r = el.getBoundingClientRect();
            let targetPi = pi;
            if (e.clientY >= r.top + r.height / 2) targetPi = pi + 1;
            if (srcPi !== targetPi && srcPi !== targetPi - 1) {
                const procs = _quest.processes;
                const [moved] = procs.splice(srcPi, 1);
                const insertIdx = targetPi > srcPi ? targetPi - 1 : targetPi;
                procs.splice(insertIdx, 0, moved);
                if (_selection?.proc === srcPi) _selection.proc = insertIdx;
                render(); renderPropPanel(); persistQuest();
            }
        });

        el.addEventListener('click', () => {
            if (_focusedProc != null && _focusedProc !== pi) {
                // In focused mode — switch focus to clicked process
                _focusedProc = pi;
                render(); renderPropPanel();
            } else {
                scrollToProcess(pi);
            }
        });
        processList.appendChild(el);
    });
}


function deleteProcess(pi) {
    if (!_quest) return;
    const proc = _quest.processes[pi];
    const blockCount = (proc.blocks || []).length;
    if (blockCount > 0 && !confirm(`Delete process ${pi} (${proc.comment || `process ${pi}`}) and its ${blockCount} block(s)?`)) return;
    _quest.processes.splice(pi, 1);
    if (_selection?.proc === pi) { _selection = null; }
    else if (_selection?.proc > pi) { _selection.proc--; }
    render(); renderPropPanel(); persistQuest();
}

function getQtdOrderEntry() {
    if (!_loadedSourceFiles) return null;
    for (const data of Object.values(_loadedSourceFiles)) {
        if (!data.QuestTextDataList) continue;
        const e = data.QuestTextDataList.find(e => e.TypeName === 'QUEST_TEXT_TYPE_ORDER');
        if (e) return { en: e.Message?.En ?? '', jp: e.Message?.Jp ?? '' };
    }
    return null;
}

function renderMetaCard() {
    const q = _quest;
    const isSel = _selection?.meta === true;
    const card = document.createElement('div');
    card.id = 'meta-card';
    card.className = 'meta-card' + (isSel ? ' selected' : '');
    const imgSrcInit = questImagePath(q);
    const hasImg = !!imgSrcInit;
    card.innerHTML = `
        <div class="meta-card-header">
            <span>⚙</span>
            <span>Quest ${q.quest_id ?? '???'}</span>
            <span class="meta-card-variant">v${q.variant_index ?? 0}</span>
            ${(q.enabled ?? true) === false ? `<span class="meta-card-disabled-chip" title="Quest is disabled — will not appear in-game">⛔ Disabled</span>` : ''}
            <span class="meta-card-type">${q.type ?? ''}</span>
        </div>
        <div class="meta-card-body">
            <div class="meta-card-identity">
                <div class="meta-card-identity-text">
                    <div class="meta-card-name-row">
                        <div class="meta-card-name">${escHtml(q.comment ?? '(unnamed)')}</div>
                        <button class="qtd-order-chip msg-preview-chip msg-preview-chip--dim" title="Load source files to preview order text">📋</button>
                    </div>
                    <div class="meta-card-details">
                        ${q.base_level       != null ? `<span>Lv ${q.base_level}</span>` : ''}
                        ${q.minimum_item_rank > 0   ? `<span>IR ${q.minimum_item_rank}+</span>` : ''}
                        ${q.area_id          ? `<span>${escHtml(areaIdLabel(q.area_id))}</span>` : ''}
                        ${q.next_quest ? `<span>→ q${String(q.next_quest).padStart(8,'0')}</span>` : ''}
                    </div>
                </div>
                ${q.type === 'Substory' && q.substory_group_id != null ? `<img class="meta-card-portrait" src="${substoryPortraitPath(q.substory_group_id)}" alt="NPC portrait">` : ''}
            </div>
            ${metaCardOcHtml(q)}
            ${metaCardRewardsHtml(q)}
            ${metaCardCrHtml(q)}
            ${hasImg ? `<div class="meta-card-img-wrap" style="position:relative">
                <img class="meta-card-news-img${q.type === 'WildHunt' ? ' meta-card-news-img--wildhunt' : ''}" src="${imgSrcInit}" alt="${escAttr(q.type ?? 'Quest image')}">
                <button class="meta-card-img-chip">🔍 View</button>
            </div>` : ''}
        </div>`;
    applyMetaCardTheme(card, q.type);
    card.addEventListener('click', e => { e.stopPropagation(); selectMeta(); });
    card.querySelector('.meta-card-img-chip')?.addEventListener('click', e => {
        e.stopPropagation();
        const src = questImagePath(q);
        if (src) openImgLightbox(src);
    });
    card.querySelector('.qtd-order-chip').addEventListener('click', e => {
        e.stopPropagation();
        showOrderTextPop(e.currentTarget);
    });
    syncOrderChip(card);
    world.appendChild(card);
}

function renderSourceFilesCard() {
    world.querySelector('#src-files-card')?.remove();
    closeSourceFilesSpider();
    const card = document.createElement('div');
    card.id = 'src-files-card';
    card.className = 'src-files-card' + (_clientHandle ? ' src-configured' : '');
    card.style.cssText = `position:absolute;top:0;left:${SRC_CARD_LEFT}px;width:${SRC_CARD_W}px;`;
    const pathLabel = _clientHandle ? escHtml(_clientHandle.name) : 'Not configured';
    card.innerHTML = `
        <div class="src-card-header">
            <span class="src-card-icon">📁</span>
            <div class="src-card-title">
                <div class="src-card-title-main">SOURCE FILES</div>
                <div class="src-card-title-sub">QUEST DATA</div>
            </div>
        </div>
        <div class="src-card-body">
            <div class="src-card-path ${_clientHandle ? 'src-path-ok' : 'src-path-none'}">${pathLabel}</div>
            <div style="display:flex;gap:4px;flex-wrap:wrap">
                <button class="src-card-btn src-card-btn-dir">${_clientHandle ? '↺ Change Dir' : '+ Load Directory'}</button>
                ${_clientHandle ? `<button class="src-card-btn src-card-btn-clear">✕ Clear</button>` : ''}
            </div>
            ${_clientHandle && _quest?.quest_id == null ? `<span style="font-size:9px;color:var(--text2)">Set a Quest ID to load files.</span>` : ''}
        </div>`;
    card.querySelector('.src-card-btn-dir').addEventListener('click', e => { e.stopPropagation(); pickClientDir(); });
    card.querySelector('.src-card-btn-clear')?.addEventListener('click', e => { e.stopPropagation(); clearClientDir(); });
    world.appendChild(card);
}

function syncSourceFilesCard() {
    if (_quest || world.querySelector('#src-files-card')) renderSourceFilesCard();
}

function closeSourceFilesSpider() {
    world.querySelector('#src-spider')?.remove();
    world.querySelector('.src-file-detail')?.remove();
    syncOrderChip();
}

async function loadAndSpiderSourceFiles() {
    const files = await readQuestSourceFiles(_quest?.quest_id);
    if (!files) {
        return;
    }
    localStorage.setItem(LS_SRC_LOADED, '1');
    openSourceFilesSpider(files);
}

async function maybeAutoLoadSourceFiles() {
    if (!_quest || !_clientHandle) return;
    if (world.querySelector('#src-spider')) return; // already showing
    await loadAndSpiderSourceFiles();
}

function openSourceFilesSpider(files) {
    closeSourceFilesSpider();
    const fileEntries = Object.entries(files).sort(([a], [b]) => a.localeCompare(b));
    if (!fileEntries.length) return;

    // Cache source files and build MSS group serial lookup
    _loadedSourceFiles = files;
    _mssGroupMap = new Map();
    for (const [fname, data] of fileEntries) {
        if (!fname.includes('.mss.')) continue;
        for (const grp of (data.NativeMsgGroupArray ?? [])) {
            if (grp.GroupSerial == null) continue;
            const npcName = grp.NpcName?.En ?? grp.NpcName?.Jp ?? `NPC ${grp.NpcId ?? '?'}`;
            const npcId   = grp.NpcId ?? null;
            const msgs = (grp.MsgData ?? []).map(m => ({
                en: m.Message?.En ?? '',
                jp: m.Message?.Jp ?? '',
            })).filter(m => m.en || m.jp);
            _mssGroupMap.set(grp.GroupSerial, { npcName, npcId, msgs });
        }
    }
    syncOrderChip();

    // Auto-populate quest comment from QTD Name entry if not already set
    if (_quest && !_quest.comment) {
        for (const [fname, data] of fileEntries) {
            if (!fname.includes('.qtd.')) continue;
            const nameEntry = (data.QuestTextDataList ?? []).find(e => e.TypeName === 'QUEST_TEXT_TYPE_NAME');
            const name = nameEntry?.Message?.En || nameEntry?.Message?.Jp;
            if (name) {
                _quest.comment = name;
                persistQuest();
                syncMetaCard();
                questTitleDisplay.textContent = name;
                break;
            }
        }
    }

    const NODE_W   = 175;
    const NODE_GAP = 12;
    const CONN_GAP = 36; // horizontal bezier slack

    // Use actual card height to find true center
    const srcCard    = world.querySelector('#src-files-card');
    const cardH      = srcCard?.offsetHeight ?? 140;
    const cardCenterY = cardH / 2; // world Y of card's vertical center

    // Each node gets auto height — estimate 62px for spacing only
    const NODE_H_EST = 62;
    const totalH    = fileEntries.length * (NODE_H_EST + NODE_GAP) - NODE_GAP;

    // World-space top of first node, centred on card
    const nodesTopWorld  = cardCenterY - totalH / 2;
    // Container sits at the top of the earliest element (card or nodes)
    const containerTopWorld  = Math.min(nodesTopWorld, 0) - 10;
    const containerLeft  = SRC_CARD_LEFT - NODE_W - CONN_GAP * 2;

    const container = document.createElement('div');
    container.id = 'src-spider';
    container.style.cssText = `position:absolute;top:${containerTopWorld}px;left:${containerLeft}px;` +
        `pointer-events:none;overflow:visible;`;

    // SVG — same origin as container, overflow:visible so beziers aren't clipped
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', NODE_W + CONN_GAP * 2 + 4);
    svg.setAttribute('height', 10); // doesn't matter — overflow:visible
    svg.style.cssText = `position:absolute;top:0;left:0;overflow:visible;pointer-events:none;`;

    const FILE_COLORS = ['#52b8e8','#52e052','#e89852','#b852e8','#52e8c8','#e85252','#e0d852','#e852a8'];

    // Hub = left edge of source card, vertically centred — in container-local coords
    const hubX = NODE_W + CONN_GAP * 2; // container-local X = (SRC_CARD_LEFT) - containerLeft
    const hubY = cardCenterY - containerTopWorld; // container-local Y

    fileEntries.forEach(([fname, data], i) => {
        const color = FILE_COLORS[i % FILE_COLORS.length];

        // Node top in container-local coords
        const nodeTopLocal  = (nodesTopWorld + i * (NODE_H_EST + NODE_GAP)) - containerTopWorld;
        const nodeMidYLocal = nodeTopLocal + NODE_H_EST / 2;

        // Bezier: from node right-center → hub
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const cx1  = NODE_W + CONN_GAP;
        const cx2  = hubX   - CONN_GAP;
        path.setAttribute('d', `M${NODE_W},${nodeMidYLocal} C${cx1},${nodeMidYLocal} ${cx2},${hubY} ${hubX},${hubY}`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', '1.5');
        path.setAttribute('stroke-opacity', '0.5');
        svg.appendChild(path);

        // Summary badge
        let typeBadge, summary;
        if (fname.includes('.qst.')) {
            typeBadge = 'QST';
            const n = (data.QuestStageList ?? []).reduce((s, st) => s + (st.QuestGrp?.length ?? 0), 0);
            summary = `${n} group${n !== 1 ? 's' : ''}`;
        } else if (fname.includes('.qmi.') || fname.includes('.fmi.')) {
            typeBadge = fname.includes('.fmi.') ? 'FMI' : 'QMI';
            const n = (data.InfoList ?? []).length;
            summary = `${n} marker${n !== 1 ? 's' : ''}${data.StageName?.En ? ` · ${data.StageName.En}` : ''}`;
        } else if (fname.includes('.fsm.')) {
            typeBadge = 'FSM';
            summary = 'NPC walk FSM';
        } else if (fname.includes('.gmd.')) {
            typeBadge = 'GMD';
            const n = (data.Indices ?? []).length;
            summary = `${n} message${n !== 1 ? 's' : ''}`;
        } else if (fname.includes('.qtd.')) {
            typeBadge = 'QTD';
            const n = (data.QuestTextDataList ?? []).length;
            summary = `${n} text entr${n !== 1 ? 'ies' : 'y'}`;
        } else if (fname.includes('.mss.')) {
            typeBadge = 'MSS';
            const n = (data.NativeMsgGroupArray ?? []).length;
            summary = `${n} NPC group${n !== 1 ? 's' : ''}`;
        } else {
            typeBadge = fname.split('.').slice(-2, -1)[0]?.toUpperCase() ?? 'FILE';
            summary = '';
        }
        const shortName = fname.replace(/^(?:npc\/)?q\d+_?/, '').replace(/\.json$/, '') || fname;

        const node = document.createElement('div');
        node.className = 'src-file-node';
        node.style.cssText = `position:absolute;left:0;top:${nodeTopLocal}px;width:${NODE_W}px;` +
            `--sf-color:${color};pointer-events:all;cursor:pointer;`;
        node.innerHTML = `
            <div class="src-file-node-name" style="color:${color}">
                <span class="src-file-type-badge" style="background:${color}20;color:${color}">${escHtml(typeBadge)}</span>
                ${escHtml(shortName)}
            </div>
            <div class="src-file-node-sub">${escHtml(fname)}</div>
            <div class="src-file-node-meta">${escHtml(summary)}</div>`;
        node.addEventListener('click', e => {
            e.stopPropagation();
            if (fname.includes('.fsm.')) openFsmGraph(fname, data, color, node);
            else openSourceFileDetail(node, fname, data, color);
        });
        container.appendChild(node);
    });

    container.appendChild(svg);
    world.appendChild(container);

    // Auto-reopen any panels that were pinned in the previous session
    fileEntries.forEach(([fname, data], i) => {
        const saved = getPanelState(fname);
        if (!saved?.pinned) return;
        const color = FILE_COLORS[i % FILE_COLORS.length];
        if (fname.includes('.fsm.')) openFsmGraph(fname, data, color, null);
        else openSourceFileDetail(null, fname, data, color);
    });
}

// ── Quest index + picker (for auxiliary viewers) ──────────────────────────────

async function getAuxQuestIndex() {
    if (_auxQuestIndex !== null) return _auxQuestIndex;
    if (!_clientHandle) return (_auxQuestIndex = []);
    const entries = [];
    try {
        const questDir = await _clientHandle.getDirectoryHandle('quest');
        for await (const [name, entry] of questDir.entries()) {
            if (entry.kind !== 'directory') continue;
            const m = name.match(/^q(\d+)$/);
            if (m) entries.push({ id: parseInt(m[1], 10) });
        }
        entries.sort((a, b) => a.id - b.id);
    } catch (_) {}
    return (_auxQuestIndex = entries);
}

async function loadAuxQuestName(id) {
    if (_auxQuestNames.has(id)) return _auxQuestNames.get(id);
    if (!_clientHandle) return null;
    const padded = String(id).padStart(8, '0');
    try {
        let d = _clientHandle;
        d = await d.getDirectoryHandle('quest');
        d = await d.getDirectoryHandle(`q${padded}`);
        d = await d.getDirectoryHandle('quest');
        d = await d.getDirectoryHandle(padded);
        for await (const [fname, fentry] of d.entries()) {
            if (fentry.kind !== 'file' || !fname.includes('.qtd.') || !fname.endsWith('.json')) continue;
            const text = await (await fentry.getFile()).text();
            const data = JSON.parse(text);
            const nameEntry = (data.QuestTextDataList ?? []).find(e => e.TypeName === 'QUEST_TEXT_TYPE_NAME');
            const name = nameEntry?.Message?.En || nameEntry?.Message?.Jp || null;
            _auxQuestNames.set(id, name);
            return name;
        }
    } catch (_) {}
    _auxQuestNames.set(id, null);
    return null;
}

// Quest ID fuzzy picker — similar to buildMsgPicker but for quest IDs from the client dir
function buildQuestPicker(currentId, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'quest-picker';

    const inputVal  = currentId != null ? String(currentId) : '';
    const paddedVal = currentId != null ? `q${String(currentId).padStart(8, '0')}` : '';
    wrap.innerHTML = `
        <div class="quest-picker-inner">
            <input type="text" class="quest-picker-input prop-input"
                   value="${escAttr(inputVal)}"
                   placeholder="${_clientHandle ? 'Quest ID or name…' : 'Quest ID…'}"
                   autocomplete="off" spellcheck="false">
            ${paddedVal ? `<span class="msg-serial-badge">${escHtml(paddedVal)}</span>` : ''}
        </div>`;

    const input = wrap.querySelector('.quest-picker-input');
    const inner = wrap.querySelector('.quest-picker-inner');

    // Dropdown lives on document.body to escape the card's overflow:hidden and
    // the world transform that would break position:fixed inside it.
    const dropdown = document.createElement('div');
    dropdown.className = 'msg-picker-dropdown quest-picker-dropdown';
    dropdown.style.display = 'none';

    function closeDropdown() {
        dropdown.style.display = 'none';
        dropdown.remove();
    }

    function updateBadge(id) {
        inner.querySelector('.msg-serial-badge')?.remove();
        if (id != null) {
            const badge = document.createElement('span');
            badge.className = 'msg-serial-badge';
            badge.textContent = `q${String(id).padStart(8, '0')}`;
            input.after(badge);
        }
    }

    function setSelected(id) {
        input.value = id != null ? String(id) : '';
        updateBadge(id);
        closeDropdown();
        onChange(id);
    }

    async function populate(query) {
        if (!_clientHandle) { closeDropdown(); return; }
        const index = await getAuxQuestIndex();
        const raw      = (query ?? '').trim();
        const hasQPfx  = /^q/i.test(raw);
        const q        = raw.replace(/^q/i, '');
        const ql       = q.toLowerCase();

        let matches;
        if (!q) {
            matches = index.slice(0, 30);
        } else {
            matches = [];
            for (const entry of index) {
                const padded  = String(entry.id).padStart(8, '0');
                // With 'q' prefix → startsWith (user is targeting the q-notation directly)
                // Without prefix  → substring on padded or raw id, plus name search
                const idMatch = hasQPfx
                    ? padded.startsWith(q)
                    : padded.includes(q) || String(entry.id).includes(q);
                const name    = _auxQuestNames.get(entry.id);
                const nmMatch = !hasQPfx && name != null && name.toLowerCase().includes(ql);
                if (idMatch || nmMatch) matches.push(entry);
                if (matches.length >= 40) break;
            }
        }

        if (!matches.length) { closeDropdown(); return; }

        dropdown.innerHTML = '';
        for (const entry of matches) {
            const padded = String(entry.id).padStart(8, '0');
            const name   = _auxQuestNames.get(entry.id) ?? null;
            const item = document.createElement('div');
            item.className = 'msg-option quest-opt';
            item.dataset.id = entry.id;
            item.innerHTML = `
                <div class="msg-opt-hdr">
                    <span class="msg-opt-serial">q${escHtml(padded)}</span>
                    ${name ? `<span class="msg-opt-name">${escHtml(name)}</span>` : ''}
                </div>`;
            item.addEventListener('mousedown', e => { e.preventDefault(); setSelected(entry.id); });
            dropdown.appendChild(item);
        }

        // Position below the input (fixed to viewport)
        const rect = input.getBoundingClientRect();
        dropdown.style.left  = `${rect.left}px`;
        dropdown.style.top   = `${rect.bottom + 2}px`;
        dropdown.style.width = `${rect.width}px`;
        dropdown.style.display = 'block';
        if (!dropdown.parentNode) document.body.appendChild(dropdown);

        // Lazily load names for visible items
        for (const entry of matches) {
            if (!_auxQuestNames.has(entry.id)) {
                loadAuxQuestName(entry.id).then(name => {
                    if (name == null) return;
                    const item = dropdown.querySelector(`.quest-opt[data-id="${entry.id}"]`);
                    if (!item) return;
                    const hdr = item.querySelector('.msg-opt-hdr');
                    if (hdr && !hdr.querySelector('.msg-opt-name')) {
                        const span = document.createElement('span');
                        span.className = 'msg-opt-name';
                        span.textContent = name;
                        hdr.appendChild(span);
                    }
                }).catch(() => {});
            }
        }
    }

    input.addEventListener('focus', () => populate(input.value));
    input.addEventListener('input', () => populate(input.value));
    input.addEventListener('blur', () => {
        setTimeout(() => closeDropdown(), 160);
        const raw   = input.value.trim();
        const asNum = parseInt(raw);
        if (raw !== '' && !isNaN(asNum) && asNum > 0) setSelected(asNum);
        else if (raw === '') setSelected(null);
    });

    // Clean up dropdown when the picker is removed from DOM
    const obs = new MutationObserver(() => {
        if (!wrap.isConnected) { closeDropdown(); obs.disconnect(); }
    });
    obs.observe(document.body, { childList: true, subtree: true });

    return wrap;
}

// ── Auxiliary Quest Viewers ────────────────────────────────────────────────────

function auxViewersKey() {
    return `ddon-aux-viewers-${_quest?.quest_id ?? 'default'}`;
}

function loadAuxViewers() {
    try { _auxViewers = JSON.parse(localStorage.getItem(auxViewersKey()) ?? '[]'); }
    catch (_) { _auxViewers = []; }
}

function saveAuxViewers() {
    try { localStorage.setItem(auxViewersKey(), JSON.stringify(_auxViewers)); } catch (_) {}
}

function renderAllAuxViewers() {
    world.querySelectorAll('.aux-viewer-wrap').forEach(el => el.remove());
    for (const viewer of _auxViewers) renderAuxViewer(viewer);
}

function renderAuxViewer(viewer) {
    world.querySelector(`.aux-viewer-wrap[data-id="${viewer.id}"]`)?.remove();

    const NODE_W   = 175;
    const CONN_GAP = 36;

    // The viewer.x/y is the world-space position of the left edge of the source card.
    // Container extends further left to make room for spider nodes.
    const containerLeft = viewer.x - (NODE_W + CONN_GAP * 2);
    const containerTop  = viewer.y;

    const wrap = document.createElement('div');
    wrap.className = 'aux-viewer-wrap';
    wrap.dataset.id = viewer.id;
    wrap.style.cssText = `position:absolute;left:${containerLeft}px;top:${containerTop}px;overflow:visible;pointer-events:none;`;

    // Source card
    const card = document.createElement('div');
    card.className = 'src-files-card aux-src-card' + (_clientHandle ? ' src-configured' : '');
    card.style.cssText = `position:absolute;left:${NODE_W + CONN_GAP * 2}px;top:0;width:${SRC_CARD_W}px;pointer-events:all;`;

    const hasClient = !!_clientHandle;
    const questIdVal = viewer.questId ?? null;
    const padded = questIdVal != null ? String(questIdVal).padStart(8, '0') : '';
    card.innerHTML = `
        <div class="src-card-header aux-drag-handle">
            <span class="src-card-icon">📁</span>
            <div class="src-card-title">
                <div class="src-card-title-main">AUX VIEWER</div>
                <div class="src-card-title-sub aux-subtitle">${padded ? `q${escHtml(padded)}` : 'QUEST DATA'}</div>
            </div>
            <button class="aux-close-btn" title="Remove viewer">✕</button>
        </div>
        <div class="src-card-body aux-card-body"></div>`;

    // Drag
    const dragHandle = card.querySelector('.aux-drag-handle');
    dragHandle.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        const startX = e.clientX, startY = e.clientY;
        const startLeft = parseFloat(wrap.style.left);
        const startTop  = parseFloat(wrap.style.top);
        let moved = false;
        dragHandle.style.cursor = 'grabbing';
        const mv = ev => {
            moved = true;
            wrap.style.left = `${startLeft + (ev.clientX - startX) / _cam.z}px`;
            wrap.style.top  = `${startTop  + (ev.clientY - startY) / _cam.z}px`;
        };
        const up = () => {
            document.removeEventListener('mousemove', mv);
            document.removeEventListener('mouseup', up);
            dragHandle.style.cursor = '';
            if (moved) {
                viewer.x = parseFloat(wrap.style.left) + NODE_W + CONN_GAP * 2;
                viewer.y = parseFloat(wrap.style.top);
                saveAuxViewers();
                _suppressNextDocClick = true;
                setTimeout(() => { _suppressNextDocClick = false; }, 0);
            }
        };
        document.addEventListener('mousemove', mv);
        document.addEventListener('mouseup', up);
    });

    // Close
    card.querySelector('.aux-close-btn').addEventListener('click', e => {
        e.stopPropagation();
        removeAuxViewer(viewer.id);
    });

    // Quest picker in card body
    const body = card.querySelector('.aux-card-body');
    if (hasClient) {
        const picker = buildQuestPicker(questIdVal, id => {
            if (id != null && id > 0) {
                viewer.questId = id;
                saveAuxViewers();
                // Update subtitle
                const sub = card.querySelector('.aux-subtitle');
                if (sub) sub.textContent = `q${String(id).padStart(8, '0')}`;
                loadAuxViewerFiles(viewer, wrap, card);
            }
        });
        body.appendChild(picker);
    } else {
        body.innerHTML = `<span style="font-size:9px;color:var(--text2)">Configure Source Files directory first.</span>`;
    }

    wrap.appendChild(card);
    world.appendChild(wrap);

    // Auto-load files if we have both a questId and a client handle
    if (hasClient && viewer.questId) {
        loadAuxViewerFiles(viewer, wrap, card).catch(() => {});
    }
}

async function loadAuxViewerFiles(viewer, wrap, card) {
    if (!_clientHandle || !viewer.questId) return;
    const sub = card.querySelector('.src-card-title-sub');
    if (sub) sub.textContent = 'Loading…';
    const files = await readQuestSourceFiles(viewer.questId);
    const padded = String(viewer.questId).padStart(8, '0');
    if (!files) {
        if (sub) sub.textContent = `q${padded} – not found`;
        return;
    }
    if (sub) sub.textContent = `q${padded}`;
    wrap.querySelector('.aux-spider')?.remove();
    openAuxSpider(viewer, wrap, card, files);
}

function openAuxSpider(viewer, wrap, card, files) {
    const fileEntries = Object.entries(files).sort(([a], [b]) => a.localeCompare(b));
    if (!fileEntries.length) return;

    const NODE_W   = 175;
    const NODE_GAP = 12;
    const CONN_GAP = 36;
    const NODE_H_EST = 62;

    const cardH = card.offsetHeight || 140;
    const cardCenterY = cardH / 2;
    const totalH = fileEntries.length * (NODE_H_EST + NODE_GAP) - NODE_GAP;
    const nodesTop = cardCenterY - totalH / 2;
    const containerTop = Math.min(nodesTop, 0) - 10;

    const container = document.createElement('div');
    container.className = 'aux-spider';
    container.style.cssText = `position:absolute;top:${containerTop}px;left:0;pointer-events:none;overflow:visible;`;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', NODE_W + CONN_GAP * 2 + 4);
    svg.setAttribute('height', 10);
    svg.style.cssText = `position:absolute;top:0;left:0;overflow:visible;pointer-events:none;`;

    const FILE_COLORS = ['#52b8e8','#52e052','#e89852','#b852e8','#52e8c8','#e85252','#e0d852','#e852a8'];

    const hubX = NODE_W + CONN_GAP * 2;
    const hubY = cardCenterY - containerTop;

    fileEntries.forEach(([fname, data], i) => {
        const color = FILE_COLORS[i % FILE_COLORS.length];
        const nodeTopLocal = (nodesTop + i * (NODE_H_EST + NODE_GAP)) - containerTop;
        const nodeMidYLocal = nodeTopLocal + NODE_H_EST / 2;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const cx1 = NODE_W + CONN_GAP, cx2 = hubX - CONN_GAP;
        path.setAttribute('d', `M${NODE_W},${nodeMidYLocal} C${cx1},${nodeMidYLocal} ${cx2},${hubY} ${hubX},${hubY}`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', '1.5');
        path.setAttribute('stroke-opacity', '0.5');
        svg.appendChild(path);

        let typeBadge, summary;
        if (fname.includes('.qst.'))       { typeBadge = 'QST'; const n = (data.QuestStageList ?? []).reduce((s,st) => s+(st.QuestGrp?.length??0),0); summary = `${n} group${n!==1?'s':''}`; }
        else if (fname.includes('.mss.'))  { typeBadge = 'MSS'; const n = (data.NativeMsgGroupArray ?? []).length; summary = `${n} NPC group${n!==1?'s':''}`; }
        else if (fname.includes('.qtd.'))  { typeBadge = 'QTD'; const n = (data.QuestTextDataList ?? []).length; summary = `${n} text entr${n!==1?'ies':'y'}`; }
        else if (fname.includes('.qmi.'))  { typeBadge = 'QMI'; const n = (data.InfoList ?? []).length; summary = `${n} marker${n!==1?'s':''}`; }
        else if (fname.includes('.fmi.'))  { typeBadge = 'FMI'; const n = (data.InfoList ?? []).length; summary = `${n} marker${n!==1?'s':''}`; }
        else if (fname.includes('.fsm.'))  { typeBadge = 'FSM'; summary = 'NPC walk FSM'; }
        else if (fname.includes('.gmd.'))  { typeBadge = 'GMD'; const n = (data.Indices ?? []).length; summary = `${n} message${n!==1?'s':''}`; }
        else { typeBadge = fname.split('.').slice(-2,-1)[0]?.toUpperCase() ?? 'FILE'; summary = ''; }

        const shortName = fname.replace(/^(?:npc\/)?q\d+_?/, '').replace(/\.json$/, '') || fname;

        const node = document.createElement('div');
        node.className = 'src-file-node';
        node.style.cssText = `position:absolute;left:0;top:${nodeTopLocal}px;width:${NODE_W}px;--sf-color:${color};pointer-events:all;cursor:pointer;`;
        node.innerHTML = `
            <div class="src-file-node-name" style="color:${color}">
                <span class="src-file-type-badge" style="background:${color}20;color:${color}">${escHtml(typeBadge)}</span>
                ${escHtml(shortName)}
            </div>
            <div class="src-file-node-sub">${escHtml(fname)}</div>
            <div class="src-file-node-meta">${escHtml(summary)}</div>`;
        node.addEventListener('click', e => {
            e.stopPropagation();
            if (fname.includes('.fsm.')) openFsmGraph(fname, data, color, node);
            else openSourceFileDetail(node, fname, data, color);
        });
        container.appendChild(node);
    });

    container.appendChild(svg);
    wrap.appendChild(container);
}

function addAuxViewer(worldX, worldY) {
    const id = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const viewer = { id, questId: null, x: worldX, y: worldY };
    _auxViewers.push(viewer);
    saveAuxViewers();
    renderAuxViewer(viewer);
}

function removeAuxViewer(id) {
    _auxViewers = _auxViewers.filter(v => v.id !== id);
    saveAuxViewers();
    world.querySelector(`.aux-viewer-wrap[data-id="${id}"]`)?.remove();
}

function attachResize(panel, minW = 260, minH = 180, onResized = null) {
    function makeHandle(cls, onMove) {
        const h = document.createElement('div');
        h.className = cls;
        panel.appendChild(h);
        h.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            e.stopPropagation(); e.preventDefault();
            const startW = panel.offsetWidth,    startH = panel.offsetHeight;
            const startL = parseFloat(panel.style.left) || 0;
            const startX = e.clientX,            startY = e.clientY;
            let resized = false;
            const mv = e => { resized = true; onMove(e, startW, startH, startL, startX, startY); };
            const up = () => {
                document.removeEventListener('mousemove', mv);
                document.removeEventListener('mouseup', up);
                if (resized) {
                    _suppressNextDocClick = true;
                    setTimeout(() => { _suppressNextDocClick = false; }, 0);
                    onResized?.();
                }
            };
            document.addEventListener('mousemove', mv);
            document.addEventListener('mouseup', up);
        });
    }

    // Bottom-right: expand right + down
    makeHandle('panel-resize-handle panel-resize-br', (e, startW, startH, _startL, startX, startY) => {
        panel.style.width  = `${Math.max(minW, startW + (e.clientX - startX) / _cam.z)}px`;
        panel.style.height = `${Math.max(minH, startH + (e.clientY - startY) / _cam.z)}px`;
    });

    // Bottom-left: expand left + down (left edge moves, width grows leftward)
    makeHandle('panel-resize-handle panel-resize-bl', (e, startW, startH, startL, startX, startY) => {
        const dx   = (e.clientX - startX) / _cam.z;
        const newW = Math.max(minW, startW - dx);
        panel.style.width  = `${newW}px`;
        panel.style.height = `${Math.max(minH, startH + (e.clientY - startY) / _cam.z)}px`;
        panel.style.left   = `${startL + startW - newW}px`;
    });
}

function openFsmGraph(fname, data, color, anchorEl) {
    const existing = world.querySelector(`.fsm-graph-panel[data-fname="${CSS.escape(fname)}"]`);
    if (existing) { existing.style.zIndex = '601'; return; }
    document.querySelectorAll('.fsm-graph-panel:not(.src-detail-pinned)').forEach(p => p.remove());

    const cluster = data.RootCluster;
    if (!cluster) { openSourceFileDetail(anchorEl, fname, data, color); return; }

    const nodes      = cluster.NodeList ?? [];
    const initialId  = cluster.InitialStateId ?? 0;
    const condTrees  = data.ConditionTree?.TreeList ?? [];

    // ── Condition tree → readable string ─────────────────────────────────────
    const OP = { 0:'✓', 1:'NOT', 2:'AND', 3:'OR', 4:'XOR', 5:'=', 6:'≠', 7:'<', 8:'≥', 9:'>', 10:'≤' };
    function condNodeStr(node) {
        if (!node) return '';
        const cls = (node['@class'] ?? '').split('.').pop();
        if (cls === 'AIConditionTreeOperationNode') {
            const op = node.Operator ?? 0;
            if (op === 0) return '✓';
            const kids = (node.ChildList ?? []).map(condNodeStr).filter(Boolean);
            if (op === 1) return `NOT ${kids[0] ?? ''}`;
            return kids.join(` ${OP[op] ?? op} `);
        }
        if (cls === 'AIConditionTreeVariableNode')
            return node.Variable?.PropertyName || node.Variable?.OwnerName || '?';
        if (cls.includes('ConstF32') || cls.includes('ConstS32') || cls.includes('ConstBool'))
            return String(node.Value ?? '?');
        return '';
    }
    function condLabel(id, exists) {
        if (!exists) return '✓';
        const tree = condTrees.find(t => (t.Name?.Id ?? t.Name) === id);
        if (!tree) return `cond:${id}`;
        return condNodeStr(tree.RootNode) || '✓';
    }

    // ── Process → summary line ────────────────────────────────────────────────
    function procLine(proc) {
        const name = proc.ContainerName ?? '';
        const p    = proc.Parameter ?? {};
        switch (name) {
            case 'checkMyQuestFlag':      return `🚩 chk flag:${p.FlagNo}${p.QuestName?.En ? ` (${p.QuestName.En})` : ''}`;
            case 'setMyQuestFlag':        return `✅ set flag:${p.FlagNo}`;
            case 'clearMyQuestFlag':      return `❌ clr flag:${p.FlagNo}`;
            case 'SetGoto':               return `🚶 → (${Math.round(p.TargetPos?.X??0)}, ${Math.round(p.TargetPos?.Z??0)})`;
            case 'SetWait':               return `⏸ wait`;
            case 'SetWaitTime':           return `⏱ ${p.WaitTime ?? '?'}s`;
            case 'CallMessage':           return `💬 msg#${p.MsgNo ?? '?'}${p.QuestName?.En ? ` (${p.QuestName.En})` : ''}`;
            case 'MainQstFlagOn':         return `🚩 flag:${p.FlagNo}${p.QuestName?.En ? ` "${p.QuestName.En}"` : p.QuestId != null ? ` q${p.QuestId}` : ''}`;
            case 'MainQstFlagOff':        return `🔕 flag:${p.FlagNo}${p.QuestName?.En ? ` "${p.QuestName.En}"` : p.QuestId != null ? ` q${p.QuestId}` : ''}`;
            case 'SetDisableTouchAction': return `👆 touch:${p.IsDisableTouch ? 'off' : 'on'}`;
            case 'SetHeadCtrl':           return `👁 head:${p.HeadCtrl ?? '?'}`;
            case 'SetMotion':             return `🎬 mot:${p.MotNo ?? '?'}${p.IsLoop ? ' ↺' : ''}`;
            case 'Talk':                  return `🗣 talk`;
            default:                      return name;
        }
    }

    // ── Layout: Uipos initial placement + collision resolution ────────────────
    const NODE_W      = 200;
    const NODE_HDR_H  = 26;   // header row height
    const PROC_LINE_H = 18;   // per process line
    const NODE_SUB_H  = 20;   // sub-cluster row
    const PAD         = 60;
    const GAP         = 48;   // minimum gap between nodes
    const SPREAD_X    = 2.2;
    const SPREAD_Y    = 2.4;

    // Estimate each node's rendered height
    function nodeHeight(node) {
        const procs = (node.ProcessList ?? []).length;
        const sub   = node.SubCluster ? NODE_SUB_H : 0;
        return NODE_HDR_H + procs * PROC_LINE_H + sub + (procs > 0 ? 8 : 0);
    }

    const xs = nodes.map(n => n.Uipos?.UiposX ?? 0);
    const ys = nodes.map(n => n.Uipos?.UiposY ?? 0);
    const minX = nodes.length ? Math.min(...xs) : 0;
    const minY = nodes.length ? Math.min(...ys) : 0;

    // Initial placement from Uipos
    const pos = nodes.map(node => ({
        id: node.Id,
        x:  (( node.Uipos?.UiposX ?? 0) - minX) * SPREAD_X + PAD,
        y:  (( node.Uipos?.UiposY ?? 0) - minY) * SPREAD_Y + PAD,
        h:  nodeHeight(node),
    }));

    // Iterative collision resolution — push overlapping pairs apart
    for (let iter = 0; iter < 300; iter++) {
        let moved = false;
        for (let i = 0; i < pos.length; i++) {
            for (let j = i + 1; j < pos.length; j++) {
                const a = pos[i], b = pos[j];
                const ox = Math.min(a.x + NODE_W + GAP, b.x + NODE_W + GAP) - Math.max(a.x, b.x);
                const oy = Math.min(a.y + a.h  + GAP, b.y + b.h  + GAP) - Math.max(a.y, b.y);
                if (ox > 0 && oy > 0) {
                    const push = (ox <= oy ? ox : oy) / 2 + 1;
                    if (ox <= oy) {
                        if (a.x <= b.x) { a.x -= push; b.x += push; }
                        else             { a.x += push; b.x -= push; }
                    } else {
                        if (a.y <= b.y) { a.y -= push; b.y += push; }
                        else             { a.y += push; b.y -= push; }
                    }
                    moved = true;
                }
            }
        }
        if (!moved) break;
    }

    // Re-normalise so nothing goes negative
    const pMinX = Math.min(...pos.map(p => p.x));
    const pMinY = Math.min(...pos.map(p => p.y));
    if (pMinX < PAD) pos.forEach(p => p.x += PAD - pMinX);
    if (pMinY < PAD) pos.forEach(p => p.y += PAD - pMinY);

    const posById = new Map(pos.map(p => [p.id, p]));
    const pMaxX = Math.max(...pos.map(p => p.x + NODE_W));
    const pMaxY = Math.max(...pos.map(p => p.y + p.h));
    const canvasW = Math.max(600, pMaxX + PAD);
    const canvasH = Math.max(400, pMaxY + PAD);

    const nodeMap = new Map(nodes.map(n => [n.Id, n]));

    // ── SVG arrows (paths only — labels rendered in a second SVG layer above nodes)
    const arrowMarkerId = `fsmarrow${Date.now()}`;
    let svgPaths  = '';  // arrow paths — behind node cards
    const labels  = [];  // { lx, ly, txt } — collected for deoverlap then drawn above nodes

    for (const node of nodes) {
        const np  = posById.get(node.Id);
        const nx  = np?.x ?? 0;
        const ny  = np?.y ?? 0;
        const nh  = np?.h ?? NODE_HDR_H;
        for (const link of (node.LinkList ?? [])) {
            const dst    = nodeMap.get(link.DestinationNodeId);
            const dp     = dst ? posById.get(dst.Id) : null;
            const isSelf = link.DestinationNodeId === node.Id;
            const cond   = condLabel(link.ConditionId, link.ExistCondition ?? true);
            const condTxt = cond !== '✓' ? escHtml(cond) : '';
            let pathD;
            if (isSelf) {
                const cx = nx + NODE_W / 2;
                pathD = `M${cx-20},${ny} C${cx-70},${ny-90} ${cx+70},${ny-90} ${cx+20},${ny}`;
                if (condTxt) {
                    // Anchor at the top of the loop arc
                    const ax = cx, ay = ny - 80;
                    labels.push({ lx: cx, ly: ny - 106, txt: condTxt, ax, ay });
                }
            } else if (!dp) {
                // Destination not in layout (e.g. sub-cluster node) — draw stub arrow, no label
                pathD = `M${nx + NODE_W},${ny + nh / 2} L${nx + NODE_W + 30},${ny + nh / 2}`;
            } else {
                const dx  = dp.x, dy  = dp.y, dh  = dp.h;
                const goRight   = dx > nx + NODE_W / 2;
                const goDown    = dy > ny + nh / 2;
                const horizDist = Math.abs(dx - nx);
                const vertDist  = Math.abs(dy - ny);
                let fx, fy, ex, ey;
                if (horizDist >= vertDist * 0.5) {
                    fx = goRight ? nx + NODE_W : nx;  fy = ny + nh / 2;
                    ex = goRight ? dx : dx + NODE_W;  ey = dy + dh / 2;
                } else {
                    fx = nx + NODE_W / 2;  fy = goDown ? ny + nh : ny;
                    ex = dx + NODE_W / 2;  ey = goDown ? dy : dy + dh;
                }
                const cpx = (fx + ex) / 2;
                const cpy = (fy + ey) / 2;
                // For near-vertical arrows, use vertically-oriented control points so
                // the marker-end tangent at the destination is well-defined (not zero).
                const isVert = Math.abs(ex - fx) < Math.abs(ey - fy) * 0.4;
                pathD = isVert
                    ? `M${fx},${fy} C${fx},${cpy} ${ex},${cpy} ${ex},${ey}`
                    : `M${fx},${fy} C${cpx},${fy} ${cpx},${ey} ${ex},${ey}`;
                if (condTxt) {
                    // Anchor = midpoint of bezier (guaranteed to be between the two nodes)
                    const ax = (fx + ex) / 2;
                    const ay = (fy + ey) / 2;
                    // Perpendicular to arrow direction, preferring upward/leftward
                    const ddx = ex - fx, ddy = ey - fy;
                    const len = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
                    let px = -ddy / len, py = ddx / len;
                    if (py > 0 || (py === 0 && px > 0)) { px = -px; py = -py; }
                    const OFFSET = 52;
                    const labelW = condTxt.length * 5.5 + 10;
                    const LABEL_H2 = 16;
                    let lx = ax, ly = ay;
                    for (const side of [1, -1]) {
                        const clx = ax + px * OFFSET * side;
                        const cly = ay + py * OFFSET * side;
                        const hit = pos.some(p =>
                            clx + labelW / 2 > p.x - 2 && clx - labelW / 2 < p.x + NODE_W + 2 &&
                            cly + LABEL_H2 / 2 > p.y - 2 && cly - LABEL_H2 / 2 < p.y + p.h + 2
                        );
                        lx = clx; ly = cly;
                        if (!hit) break;
                    }
                    labels.push({ lx, ly, txt: condTxt, ax, ay });
                }
            }
            svgPaths += `<path d="${pathD}" stroke="${color}" stroke-width="1.5" fill="none" opacity="0.5" marker-end="url(#${arrowMarkerId})"/>`;
        }
        // Global "from all states" transition marker (also goes in label layer)
        if (node.ExistConditionTrainsitionFromAll) {
            const fromAllCond = condLabel(node.ConditionTrainsitionFromAllId, true);
            labels.push({ lx: nx + 2, ly: ny - 6, txt: `★ ${escHtml(fromAllCond !== '✓' ? fromAllCond : 'from all')}`, star: true });
        }
    }

    // Deoverlap labels: sort by y then push apart any that overlap vertically
    const LABEL_H = 16, LABEL_PAD = 2;
    labels.sort((a, b) => a.ly - b.ly || a.lx - b.lx);
    for (let pass = 0; pass < 10; pass++) {
        let moved = false;
        for (let i = 0; i < labels.length - 1; i++) {
            const a = labels[i], b = labels[i + 1];
            const overlap = (a.ly + LABEL_H / 2 + LABEL_PAD) - (b.ly - LABEL_H / 2);
            if (overlap > 0 && Math.abs(a.lx - b.lx) < (a.txt.length * 5.5 + b.txt.length * 5.5) / 2 + 8) {
                a.ly -= overlap / 2 + 1;
                b.ly += overlap / 2 + 1;
                moved = true;
            }
        }
        if (!moved) break;
    }

    // Labels are built as draggable HTML divs after panel is inserted into DOM

    // ── Node cards ────────────────────────────────────────────────────────────
    const nodeCards = nodes.map(node => {
        const np2 = posById.get(node.Id);
        const x   = np2?.x ?? 0;
        const y   = np2?.y ?? 0;
        const isInit = node.Id === initialId;
        const hasSub = !!node.SubCluster;
        const procs  = (node.ProcessList ?? []).map(pr =>
            `<div class="fsm-node-proc">${escHtml(procLine(pr))}</div>`).join('');
        return `<div class="fsm-node${isInit ? ' fsm-node-init' : ''}" style="left:${x}px;top:${y}px;width:${NODE_W}px;--fsm-c:${color}">
            <div class="fsm-node-hdr">${isInit ? '⭐ ' : ''}${escHtml(node.Name ?? `s${node.Id}`)}<span class="fsm-node-id">#${node.Id}</span></div>
            ${procs ? `<div class="fsm-node-body">${procs}</div>` : ''}
            ${hasSub ? `<div class="fsm-node-sub">⊕ ${(node.SubCluster.NodeList ?? []).length} sub-states</div>` : ''}
        </div>`;
    }).join('');

    // ── Panel ─────────────────────────────────────────────────────────────────
    const shortName = fname.replace(/\.json$/, '');
    // Extract NPC id from filename like "n12_walk.fsm" → id 12
    const npcFileMatch = fname.match(/[\/\\]?n(\d+)_/);
    const npcIdFromFile = npcFileMatch ? parseInt(npcFileMatch[1]) : null;
    const npcNameHint   = npcIdFromFile != null ? ` · NPC #${npcIdFromFile}${npcName(npcIdFromFile) !== String(npcIdFromFile) ? ` ${npcName(npcIdFromFile)}` : ''}` : '';
    const panel = document.createElement('div');
    panel.className = 'fsm-graph-panel';
    panel.dataset.fname = fname;
    panel.innerHTML = `
        <div class="fsm-graph-titlebar" style="border-bottom-color:${color}44;cursor:grab">
            <span style="color:${color};font-size:11px">⚙</span>
            <span class="fsm-graph-name" style="color:${color}">${escHtml(shortName)}</span>
            <span class="fsm-graph-meta">${nodes.length} states · init:#${initialId}${escHtml(npcNameHint)}</span>
            <button class="src-detail-pin fsm-pin" title="Pin">📌</button>
            <button class="fsm-close">✕</button>
        </div>
        <div class="fsm-graph-scroll">
            <div style="position:relative;width:${canvasW}px;height:${canvasH}px">
                <svg style="position:absolute;inset:0;width:${canvasW}px;height:${canvasH}px;overflow:visible;pointer-events:none;z-index:1">
                    <defs>
                        <marker id="${arrowMarkerId}" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                            <path d="M0,0 L7,3.5 L0,7 Z" fill="${color}" opacity="0.7"/>
                        </marker>
                    </defs>
                    ${svgPaths}
                </svg>
                ${nodeCards}
                <svg class="fsm-label-svg" style="position:absolute;inset:0;width:${canvasW}px;height:${canvasH}px;overflow:visible;pointer-events:none;z-index:10"></svg>
            </div>
        </div>`;

    panel.querySelector('.fsm-close').addEventListener('click', () => {
        clearPanelState(fname);
        panel.remove();
    });
    const fsmSave = (labelPositions) => savePanelState(fname, panel, labelPositions != null ? { labels: labelPositions } : {});
    const pinBtn = panel.querySelector('.fsm-pin');
    pinBtn.addEventListener('click', e => {
        e.stopPropagation();
        const pinned = panel.classList.toggle('src-detail-pinned');
        pinBtn.classList.toggle('src-detail-pin-active', pinned);
        pinBtn.title = pinned ? 'Unpin' : 'Pin';
        fsmSave();
    });

    // Position: restore saved state or compute from anchor
    const fsmSaved = getPanelState(fname);
    let worldX, worldY;
    if (fsmSaved) {
        worldX = fsmSaved.x; worldY = fsmSaved.y;
    } else {
        const ar  = anchorEl?.getBoundingClientRect();
        const wr  = canvasWrap.getBoundingClientRect();
        const screenLeft = ar ? Math.min(ar.right + 12, window.innerWidth - 850) : wr.left + 80;
        const screenTop  = ar ? Math.max(10, ar.top - 40) : wr.top + 60;
        worldX = (screenLeft - wr.left - _cam.x) / _cam.z;
        worldY = (screenTop  - wr.top  - _cam.y) / _cam.z;
    }
    panel.style.cssText = `position:absolute;z-index:620;left:${worldX}px;top:${worldY}px;`;
    if (fsmSaved?.w) panel.style.width  = `${fsmSaved.w}px`;
    if (fsmSaved?.h) panel.style.height = `${fsmSaved.h}px`;
    if (fsmSaved?.pinned) {
        panel.classList.add('src-detail-pinned');
        pinBtn.classList.add('src-detail-pin-active');
        pinBtn.title = 'Unpin';
    }
    attachResize(panel, 400, 300, () => fsmSave());
    world.appendChild(panel);

    // ── Draggable labels (built after panel is in DOM) ────────────────────────
    const canvasDiv = panel.querySelector('.fsm-graph-scroll > div');
    const topSvg    = panel.querySelector('.fsm-label-svg');
    const NS = 'http://www.w3.org/2000/svg';

    // Shared array tracking each draggable label's current position (for saving)
    const labelPositions = [];
    // Restore saved label positions if count matches
    const savedLabels = (fsmSaved?.labels?.length === labels.filter(l => !l.star).length)
        ? fsmSaved.labels : null;
    let savedLabelIdx = 0;

    for (const { lx: initLx, ly: initLy, txt, ax, ay, star } of labels) {
        if (star) {
            const t = document.createElementNS(NS, 'text');
            t.setAttribute('x', initLx); t.setAttribute('y', initLy);
            t.setAttribute('fill', '#f4c430'); t.setAttribute('font-size', '8');
            t.innerHTML = txt;
            topSvg.appendChild(t);
            continue;
        }
        // Use saved position if available, else computed position
        const savedPos = savedLabels?.[savedLabelIdx++];
        const lx = savedPos?.lx ?? initLx;
        const ly = savedPos?.ly ?? initLy;
        const posEntry = { lx, ly };
        labelPositions.push(posEntry);

        // Anchor dot (fixed — stays on the arrow)
        const dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('cx', ax); dot.setAttribute('cy', ay);
        dot.setAttribute('r', '2.5'); dot.setAttribute('fill', '#6a6a9a'); dot.setAttribute('opacity', '0.8');
        topSvg.appendChild(dot);
        // Leader line (x1/y1 updated when label is dragged)
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', lx); line.setAttribute('y1', ly);
        line.setAttribute('x2', ax); line.setAttribute('y2', ay);
        line.setAttribute('stroke', '#6a6a9a'); line.setAttribute('stroke-width', '0.9');
        line.setAttribute('stroke-dasharray', '4,3'); line.setAttribute('opacity', '0.75');
        topSvg.appendChild(line);
        // Draggable label div
        const lbl = document.createElement('div');
        lbl.className = 'fsm-label';
        lbl.innerHTML = txt;
        lbl.style.left = `${lx}px`;
        lbl.style.top  = `${ly}px`;
        canvasDiv.appendChild(lbl);
        lbl.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            e.stopPropagation(); e.preventDefault();
            const ox = parseFloat(lbl.style.left), oy = parseFloat(lbl.style.top);
            const sx = e.clientX, sy = e.clientY;
            lbl.style.cursor = 'grabbing';
            const mv = e => {
                const nl = ox + (e.clientX - sx) / _cam.z;
                const nt = oy + (e.clientY - sy) / _cam.z;
                lbl.style.left = `${nl}px`;
                lbl.style.top  = `${nt}px`;
                line.setAttribute('x1', nl); line.setAttribute('y1', nt);
                posEntry.lx = nl; posEntry.ly = nt;
            };
            const up = () => {
                lbl.style.cursor = '';
                document.removeEventListener('mousemove', mv);
                document.removeEventListener('mouseup', up);
                _suppressNextDocClick = true;
                setTimeout(() => { _suppressNextDocClick = false; }, 0);
                fsmSave(labelPositions);
            };
            document.addEventListener('mousemove', mv);
            document.addEventListener('mouseup', up);
        });
    }

    // Drag titlebar — deltas divided by zoom so panel stays under cursor
    const tb = panel.querySelector('.fsm-graph-titlebar');
    let _fdrag = null;
    tb.addEventListener('mousedown', e => {
        if (e.button !== 0 || e.target.closest('button')) return;
        e.stopPropagation(); e.preventDefault();
        _fdrag = {
            sx: e.clientX, sy: e.clientY,
            ox: parseFloat(panel.style.left),
            oy: parseFloat(panel.style.top),
        };
        tb.style.cursor = 'grabbing';
        panel.style.zIndex = '630';
        const mv = e => {
            if (!_fdrag) return;
            panel.style.left = `${_fdrag.ox + (e.clientX - _fdrag.sx) / _cam.z}px`;
            panel.style.top  = `${_fdrag.oy + (e.clientY - _fdrag.sy) / _cam.z}px`;
        };
        const up = () => {
            _fdrag = null;
            tb.style.cursor = 'grab';
            panel.style.zIndex = '620';
            document.removeEventListener('mousemove', mv);
            document.removeEventListener('mouseup', up);
            fsmSave(labelPositions);
        };
        document.addEventListener('mousemove', mv);
        document.addEventListener('mouseup', up);
    });

    // Close on outside click — skipped when pinned
    const fsmCloseOutside = e => {
        if (_suppressNextDocClick) return;
        if (panel.classList.contains('src-detail-pinned')) return;
        if (!panel.contains(e.target) && e.target !== anchorEl) {
            panel.remove();
            document.removeEventListener('click', fsmCloseOutside, true);
        }
    };
    setTimeout(() => document.addEventListener('click', fsmCloseOutside, true), 0);
}

function openSourceFileDetail(nodeEl, fname, data, color) {
    const existing = world.querySelector(`.src-file-detail[data-fname="${CSS.escape(fname)}"]`);
    if (existing) { existing.style.zIndex = '601'; return; }
    // Remove any existing unpinned panel; pinned panels stay open
    world.querySelectorAll('.src-file-detail:not(.src-detail-pinned)').forEach(p => p.remove());

    const panel = document.createElement('div');
    panel.className = 'src-file-detail';
    panel.dataset.fname = fname;
    panel.innerHTML = `
        <div class="src-detail-hdr" style="border-bottom-color:${color};cursor:grab">
            <span class="src-detail-title" style="color:${color}">${escHtml(fname)}</span>
            <button class="src-detail-pin" title="Pin — keeps open when clicking elsewhere">📌</button>
            <button class="src-detail-close">✕</button>
        </div>
        <div class="src-detail-body">${buildSourceHtml(Object.fromEntries([[fname, data]]))}</div>`;

    panel.querySelector('.src-detail-close').addEventListener('click', () => {
        clearPanelState(fname);
        panel.remove();
    });

    const save = () => savePanelState(fname, panel);

    const pinBtn = panel.querySelector('.src-detail-pin');
    pinBtn.addEventListener('click', e => {
        e.stopPropagation();
        const pinned = panel.classList.toggle('src-detail-pinned');
        pinBtn.classList.toggle('src-detail-pin-active', pinned);
        pinBtn.title = pinned ? 'Unpin' : 'Pin — keeps open when clicking elsewhere';
        save();
    });

    // Position: restore saved state, or compute from node anchor
    const saved = getPanelState(fname);
    let worldX, worldY;
    if (saved) {
        worldX = saved.x; worldY = saved.y;
    } else if (nodeEl) {
        const r  = nodeEl.getBoundingClientRect();
        const wr = canvasWrap.getBoundingClientRect();
        worldX = (r.right + 8 - wr.left - _cam.x) / _cam.z;
        worldY = (r.top        - wr.top  - _cam.y) / _cam.z;
    } else {
        worldX = (-_cam.x + 200) / _cam.z;
        worldY = (-_cam.y + 100) / _cam.z;
    }
    panel.style.cssText = `position:absolute;z-index:600;left:${worldX}px;top:${worldY}px;`;
    if (saved?.w) panel.style.width  = `${saved.w}px`;
    if (saved?.h) panel.style.height = `${saved.h}px`;
    if (saved?.pinned) {
        panel.classList.add('src-detail-pinned');
        pinBtn.classList.add('src-detail-pin-active');
        pinBtn.title = 'Unpin';
    }
    attachResize(panel, 260, 180, save);
    world.appendChild(panel);

    // Drag by header
    const hdr = panel.querySelector('.src-detail-hdr');
    let _pdrag = null;
    hdr.addEventListener('mousedown', e => {
        if (e.button !== 0 || e.target.closest('button')) return;
        e.stopPropagation();
        e.preventDefault();
        _pdrag = {
            sx: e.clientX, sy: e.clientY,
            ox: parseFloat(panel.style.left),
            oy: parseFloat(panel.style.top),
        };
        hdr.style.cursor = 'grabbing';
        panel.style.zIndex = '610';
        const onMove = e => {
            if (!_pdrag) return;
            panel.style.left = `${_pdrag.ox + (e.clientX - _pdrag.sx) / _cam.z}px`;
            panel.style.top  = `${_pdrag.oy + (e.clientY - _pdrag.sy) / _cam.z}px`;
        };
        const onUp = () => {
            _pdrag = null;
            hdr.style.cursor = 'grab';
            panel.style.zIndex = '600';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            save();
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    // Close on outside click — skipped when pinned
    const closeOutside = e => {
        if (_suppressNextDocClick) return;
        if (panel.classList.contains('src-detail-pinned')) return;
        if (!panel.contains(e.target) && e.target !== nodeEl) {
            panel.remove();
            document.removeEventListener('click', closeOutside, true);
        }
    };
    setTimeout(() => document.addEventListener('click', closeOutside, true), 0);
}

function selectMeta() {
    _selection = { meta: true };
    world.querySelectorAll('.block-node.selected').forEach(el => el.classList.remove('selected'));
    world.querySelectorAll('.eg-group-row.selected').forEach(el => el.classList.remove('selected'));
    world.querySelectorAll('.meta-card').forEach(el => el.classList.add('selected'));
    renderPropPanel();
    renderSidebar();
}

// ── Enemy Groups Card ──────────────────────────────────────────────────────────
function selectEnemyGroup(gi) {
    _selection = { enemyGroup: gi };
    world.querySelectorAll('.block-node.selected').forEach(el => el.classList.remove('selected'));
    world.querySelectorAll('.meta-card.selected').forEach(el => el.classList.remove('selected'));
    world.querySelectorAll('.eg-group-row').forEach(row => {
        row.classList.toggle('selected', parseInt(row.dataset.gi) === gi);
    });
    renderPropPanel();
    renderSidebar();
    openEnemyGroupSpider(gi);
}

function syncEgCard() {
    const old = world.querySelector('#eg-card');
    if (!old) return;
    const replacement = buildEgCard();
    old.replaceWith(replacement);
}

function egStageLabel(sid) {
    // stageNames entries: { name: (internal/code name), field: (readable area name), code: "stXXXX" }
    const entry = stageNames[String(sid?.id ?? '')];
    const code  = entry?.code ?? (sid?.id != null ? `st${String(sid.id).padStart(4,'0')}` : '?');
    const name  = entry?.field ?? '';   // human-readable geographic name
    const grp   = sid?.group_id != null ? `/G.${sid.group_id}` : '';
    const ref   = `${code} · #${sid?.id ?? '?'}${grp}`;
    return { code, name, grp, ref };
}

function buildEgGroupRowHtml(g, gi) {
    const sid  = g.stage_id;
    const { code, name, grp } = egStageLabel(sid);
    const display  = name || code;
    const modeLbl  = (g.placement_type || 'Automatic') === 'Manual' ? 'Manual' : 'Auto';
    const sub      = `${code} · #${sid?.id ?? '?'} · ${modeLbl}`;
    const count    = (g.enemies || []).length;
    const bosses  = (g.enemies || []).filter(e => e.is_boss).length;
    const comment = g.comment ? escHtml(g.comment) : '';
    return `<div class="eg-group-row" data-gi="${gi}">
        <div class="eg-row-main">
            <span class="eg-gi-badge">#${gi}</span>
            <span class="eg-stage-lbl">${escHtml(display)}${grp}</span>
            <span class="eg-em-count">${count}em${bosses ? ` <b>${bosses}B</b>` : ''}</span>
            ${comment ? `<span class="eg-comment">${comment}</span>` : ''}
            <button class="eg-del-btn" data-del-eg="${gi}" title="Delete group">✕</button>
        </div>
        <div class="eg-row-sub">${escHtml(sub)}</div>
    </div>`;
}

function buildEgCard() {
    const q      = _quest;
    const groups = q.enemy_groups || [];
    const card   = document.createElement('div');
    card.id        = 'eg-card';
    card.className = 'eg-card';
    card.style.cssText = `position:absolute;top:0;left:${EG_CARD_LEFT}px;width:${EG_CARD_W}px`;
    card.innerHTML = `
        <div class="eg-card-header">
            <span>⚔ Enemy Groups</span>
            <span class="eg-count-badge">${groups.length}</span>
            <button class="eg-add-btn" id="eg-add-group" title="Add enemy group">＋ Add</button>
        </div>
        <div class="eg-card-body">
            ${groups.length === 0
                ? `<div class="eg-empty">No groups yet — click ＋ Add</div>`
                : groups.map((g, gi) => buildEgGroupRowHtml(g, gi)).join('')}
        </div>`;

    card.querySelector('#eg-add-group').addEventListener('click', e => {
        e.stopPropagation();
        if (!q.enemy_groups) q.enemy_groups = [];
        q.enemy_groups.push({ stage_id: { id: 1, group_id: 1 }, enemies: [] });
        const newGi = q.enemy_groups.length - 1;
        syncEgCard();
        selectEnemyGroup(newGi);
        persistQuest();
    });

    card.querySelectorAll('.eg-group-row').forEach(row => {
        const gi = parseInt(row.dataset.gi);
        if (_selection?.enemyGroup === gi) row.classList.add('selected');
        row.addEventListener('click', e => { if (!e.target.classList.contains('eg-del-btn')) { e.stopPropagation(); selectEnemyGroup(gi); } });
        row.querySelector('.eg-del-btn')?.addEventListener('click', e => {
            e.stopPropagation();
            q.enemy_groups.splice(gi, 1);
            if (_selection?.enemyGroup === gi) _selection = null;
            else if (_selection?.enemyGroup > gi) _selection.enemyGroup--;
            syncEgCard();
            renderPropPanel();
            persistQuest();
        });
    });

    return card;
}

function renderEnemyGroupsCard() {
    world.appendChild(buildEgCard());
}

// ── Enemy Group Spider Visualization ──────────────────────────────────────────
async function loadEpData() {
    if (_epData) return _epData;
    const r = await fetch('./resources/enemyPositions.json');
    _epData = await r.json();
    return _epData;
}

function closeEnemyGroupSpider() {
    world.querySelector('#eg-spider')?.remove();
    document.querySelector('.eg-spawn-menu')?.remove();
}

async function openEnemyGroupSpider(gi) {
    closeEnemyGroupSpider();
    const q = _quest;
    const g = q?.enemy_groups?.[gi];
    if (!g) return;

    // Show loading placeholder
    const ph = document.createElement('div');
    ph.id = 'eg-spider';
    ph.style.cssText = `position:absolute;top:30px;left:${EG_CARD_LEFT + EG_CARD_W + 30}px;font-size:10px;color:var(--text2);pointer-events:none;`;
    ph.textContent = 'Loading spawn data…';
    world.appendChild(ph);

    let epData;
    try { epData = await loadEpData(); }
    catch (_) { ph.textContent = 'Spawn data unavailable'; return; }

    // Only rebuild if this group is still selected
    if (_selection?.enemyGroup !== gi) { ph.remove(); return; }
    ph.remove();

    const sid = g.stage_id || {};
    // stage_id.id is a stageNo; enemyPositions.json is keyed by the numeric part
    // of the stage code (e.g. stageNo 1 → stageNames["1"].code "st0100" → ep key "100")
    const stageEntry = stageNames[String(sid.id ?? '')];
    const epKey = stageEntry?.code
        ? String(parseInt(stageEntry.code.replace(/^st/i, ''), 10))
        : String(sid.id ?? '');
    const groupData = epData?.[epKey]?.[String(sid.group_id ?? '')];
    buildSpiderOnCanvas(gi, g, groupData);
}

function buildSpiderOnCanvas(gi, g, groupData) {
    closeEnemyGroupSpider();

    const isManual = g.placement_type === 'Manual';
    const enemies  = g.enemies || [];
    const spawns   = groupData?.spawns || [];

    const CONN_GAP = 30;           // gap between EG card right edge and map area
    const MAP_W    = 380;
    // Cap map height to the header area so the spider stays above the swimlanes.
    // Swimlanes start at META_CARD_H + META_CARD_GAP = 220; leave a few px margin.
    const MAP_H    = META_CARD_H - 10;   // 190px — fits entirely above swimlane row
    const MAP_PAD  = 22;           // padding inside map area for normalized coords
    const NODE_R   = 8;
    const TOTAL_W  = CONN_GAP + MAP_W;

    // Build posIdx → ei assignment map
    const posToEi = new Map();
    enemies.forEach((en, ei) => {
        if (isManual) { if (en.index != null) posToEi.set(en.index, ei); }
        else posToEi.set((g.starting_index ?? 0) + ei, ei);
    });

    // Compute hub Y from EG card row position (relative to world, container top=0)
    const egCard = world.querySelector('#eg-card');
    const egRow  = egCard?.querySelector(`.eg-group-row[data-gi="${gi}"]`);
    const hubY   = egRow
        ? egRow.offsetTop + egRow.offsetHeight / 2
        : 44;

    // Container sits at top:0 and is exactly MAP_H tall — always above swimlanes.
    // The SVG uses overflow:visible so the bezier can reach hub rows below MAP_H.
    const container = document.createElement('div');
    container.id = 'eg-spider';
    container.className = 'eg-spider';
    container.style.cssText = `position:absolute;top:0;left:${EG_CARD_LEFT + EG_CARD_W}px;width:${TOTAL_W}px;height:${MAP_H}px;pointer-events:none;overflow:visible;`;

    if (spawns.length === 0) {
        const noData = document.createElement('div');
        noData.className = 'eg-spider-no-data';
        noData.style.cssText = `position:absolute;left:${CONN_GAP}px;top:${MAP_H/2 - 20}px;`;
        const { name: ndName, ref: ndRef } = egStageLabel(g.stage_id);
        noData.textContent = `No spawn data for ${ndName ? `${ndName}  (${ndRef})` : ndRef}`;
        container.appendChild(noData);
        world.appendChild(container);
        return;
    }

    // Normalize spawn world coords to map pixel coords
    const xs = spawns.map(s => s.Position.x);
    const zs = spawns.map(s => s.Position.z);
    let x0 = Math.min(...xs), x1 = Math.max(...xs);
    let z0 = Math.min(...zs), z1 = Math.max(...zs);
    if (x1 - x0 < 1000) { const cx = (x0+x1)/2; x0=cx-500; x1=cx+500; }
    if (z1 - z0 < 1000) { const cz = (z0+z1)/2; z0=cz-500; z1=cz+500; }

    const toMapX = x => MAP_PAD + ((x - x0) / (x1 - x0)) * (MAP_W - 2*MAP_PAD);
    const toMapZ = z => MAP_PAD + ((z - z0) / (z1 - z0)) * (MAP_H - 2*MAP_PAD);

    // SVG covers the container but with overflow:visible so the bezier
    // connector can reach hub rows that sit below the map boundary.
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', TOTAL_W);
    svg.setAttribute('height', MAP_H);
    svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;overflow:visible;';

    // Bezier connector: hub → upward → map left-center entry point.
    const mapEntryY = MAP_H / 2;   // bezier arrives at the left-center of the map area
    const cp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    cp.setAttribute('d', `M0,${hubY} C${CONN_GAP/2},${hubY} ${CONN_GAP/2},${mapEntryY} ${CONN_GAP},${mapEntryY}`);
    cp.setAttribute('fill', 'none');
    cp.setAttribute('stroke', 'rgba(82,224,82,0.4)');
    cp.setAttribute('stroke-width', '1.5');
    svg.appendChild(cp);

    // Territory background hint
    if (groupData?.territory) {
        const t = groupData.territory;
        const tx0 = CONN_GAP + Math.max(MAP_PAD/2, Math.min(MAP_W - MAP_PAD/2, toMapX(t.xMin)));
        const tx1 = CONN_GAP + Math.max(MAP_PAD/2, Math.min(MAP_W - MAP_PAD/2, toMapX(t.xMax)));
        const tz0 = Math.max(MAP_PAD/2, Math.min(MAP_H - MAP_PAD/2, toMapZ(t.zMin)));
        const tz1 = Math.max(MAP_PAD/2, Math.min(MAP_H - MAP_PAD/2, toMapZ(t.zMax)));
        if (tx1 > tx0 && tz1 > tz0) {
            const trect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            trect.setAttribute('x', tx0); trect.setAttribute('y', tz0);
            trect.setAttribute('width', tx1 - tx0); trect.setAttribute('height', tz1 - tz0);
            trect.setAttribute('fill', 'rgba(82,224,82,0.04)');
            trect.setAttribute('stroke', 'rgba(82,224,82,0.12)');
            trect.setAttribute('stroke-width', '1');
            svg.appendChild(trect);
        }
    }

    // Spoke lines from the map entry point (bottom-left) to each spawn node
    spawns.forEach(spawn => {
        const nx = CONN_GAP + toMapX(spawn.Position.x);
        const nz = toMapZ(spawn.Position.z);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', CONN_GAP); line.setAttribute('y1', mapEntryY);
        line.setAttribute('x2', nx);       line.setAttribute('y2', nz);
        line.setAttribute('stroke', 'rgba(82,224,82,0.18)');
        line.setAttribute('stroke-width', '1');
        svg.appendChild(line);
    });

    container.appendChild(svg);

    // Map panel border (drawn last so it overlaps the spokes)
    const mapBorder = document.createElement('div');
    mapBorder.className = 'eg-spider-map';
    mapBorder.style.cssText = `position:absolute;left:${CONN_GAP}px;top:0;width:${MAP_W}px;height:${MAP_H}px;pointer-events:none;`;
    container.appendChild(mapBorder);


    // Assign a color from the palette to each unique SpawnGroup value
    const SG_COLORS = [
        '#52e052', // green   (default)
        '#52b8e8', // blue
        '#e89852', // orange
        '#b852e8', // purple
        '#52e8c8', // cyan
        '#e85252', // red
        '#e0d852', // yellow
        '#e852a8', // pink
    ];
    const uniqueSGs   = [...new Set(spawns.map(s => s.SpawnGroup))].sort((a, b) => a - b);
    const sgColorMap  = new Map(uniqueSGs.map((sg, i) => [sg, SG_COLORS[i % SG_COLORS.length]]));

    // Spawn nodes
    spawns.forEach(spawn => {
        const sx = CONN_GAP + toMapX(spawn.Position.x);
        const sz = toMapZ(spawn.Position.z);
        const posIdx    = spawn.posIdx;
        const spawnGrp  = spawn.SpawnGroup;
        const sgColor   = sgColorMap.get(spawnGrp);
        const ei        = posToEi.get(posIdx);
        const hasEnemy  = ei != null;
        const en        = hasEnemy ? enemies[ei] : null;
        const name      = en ? (enDisplayName(en) || '') : '';

        const node = document.createElement('div');
        node.className = [
            'eg-spawn-node',
            hasEnemy ? 'eg-spawn-assigned' : 'eg-spawn-empty',
            en?.is_boss ? 'eg-spawn-boss' : '',
            !isManual ? 'eg-spawn-auto' : '',
        ].filter(Boolean).join(' ');
        node.dataset.posidx   = posIdx;
        node.dataset.gi       = gi;
        node.dataset.spawngrp = spawnGrp;
        // No title= — the styled tooltip handles hover; native title causes a duplicate
        // Color the node border/glow by its SpawnGroup
        node.style.cssText = `position:absolute;left:${sx - NODE_R}px;top:${sz - NODE_R}px;` +
            `width:${NODE_R*2}px;height:${NODE_R*2}px;pointer-events:all;` +
            `--sg-color:${sgColor};`;
        node.innerHTML = hasEnemy
            ? `<span class="eg-spawn-label">${ei}</span>`
            : `<span class="eg-spawn-plus">+</span>`;

        node.addEventListener('mouseenter', () => {
            showSpawnTooltip(node, posIdx, spawnGrp, hasEnemy, name, ei, en);
            // Highlight all nodes in the same SpawnGroup
            container.querySelectorAll(`.eg-spawn-node[data-spawngrp="${spawnGrp}"]`)
                .forEach(n => n.classList.add('eg-spawn-sg-lit'));
        });
        node.addEventListener('mouseleave', () => {
            document.querySelector('.eg-spawn-tooltip')?.remove();
            container.querySelectorAll('.eg-spawn-sg-lit')
                .forEach(n => n.classList.remove('eg-spawn-sg-lit'));
        });
        node.addEventListener('click', e => {
            e.stopPropagation();
            openSpawnNodeMenu(node, posIdx, spawnGrp, spawns, gi, g, isManual, posToEi);
        });

        container.appendChild(node);
    });

    world.appendChild(container);
}

function showSpawnTooltip(nodeEl, posIdx, spawnGrp, hasEnemy, name, ei, en) {
    document.querySelector('.eg-spawn-tooltip')?.remove();
    const tip = document.createElement('div');
    tip.className = 'eg-spawn-tooltip';
    const lines = [`Spawn [${posIdx}]  ·  Set ${spawnGrp}`];
    if (hasEnemy) {
        lines.push(name || en?.enemy_id || `Enemy ${ei}`);
        lines.push(`Index: ${ei}${en?.is_boss ? ' · Boss' : ''}${en?.level ? ` · Lv${en.level}` : ''}`);
    } else {
        lines.push('Empty — click to assign');
    }
    tip.innerHTML = lines.map(l => `<div>${escHtml(l)}</div>`).join('');
    const r = nodeEl.getBoundingClientRect();
    tip.style.cssText = `position:fixed;z-index:700;left:${r.right + 6}px;top:${r.top}px;pointer-events:none;`;
    document.body.appendChild(tip);
}

function openSpawnNodeMenu(nodeEl, posIdx, spawnGrp, spawns, gi, g, isManual, posToEi) {
    document.querySelector('.eg-spawn-menu')?.remove();

    const enemies  = g.enemies || [];
    const ei       = posToEi.get(posIdx);
    const hasEnemy = ei != null;
    const en       = hasEnemy ? enemies[ei] : null;
    const name     = en ? (enDisplayName(en) || en.enemy_id || `Enemy ${ei}`) : '';

    // Positions in the same spawn set
    const sgPositions = spawns.filter(s => s.SpawnGroup === spawnGrp).map(s => s.posIdx);
    const sgHasAny    = sgPositions.some(p => posToEi.get(p) != null);

    const menu = document.createElement('div');
    menu.className = 'eg-spawn-menu';

    const copiedName = _copiedEnemy ? (enDisplayName(_copiedEnemy) || _copiedEnemy.enemy_id || 'Enemy') : null;
    const hdr = hasEnemy ? `[${posIdx}] ${name}` : `Assign to spawn [${posIdx}]`;
    menu.innerHTML = `
        <div class="eg-spawn-menu-hdr">${escHtml(hdr)}</div>
        ${hasEnemy ? `<div class="eg-spawn-menu-actions">
            <button class="eg-spawn-act-btn" data-act="edit">✎ Edit</button>
            <button class="eg-spawn-act-btn" data-act="copy">📋 Copy</button>
            ${isManual ? `<button class="eg-spawn-act-btn eg-spawn-act-rm" data-act="remove">✕ Remove</button>` : ''}
        </div>` : ''}
        ${isManual && (hasEnemy || sgHasAny) ? `
            <div class="eg-spawn-menu-sep"></div>
            <div class="eg-spawn-menu-sub">Spawn set ${spawnGrp} (${sgPositions.length} positions)</div>
            <div class="eg-spawn-menu-actions">
                ${hasEnemy ? `<button class="eg-spawn-act-btn" data-act="fill-set">⊕ Fill Set</button>` : ''}
                ${sgHasAny  ? `<button class="eg-spawn-act-btn eg-spawn-act-rm" data-act="clear-set">⊘ Clear Set</button>` : ''}
            </div>` : ''}
        ${isManual && _copiedEnemy ? `
            <div class="eg-spawn-menu-sep"></div>
            <div class="eg-spawn-menu-sub">Clipboard: ${escHtml(copiedName)}</div>
            <div class="eg-spawn-menu-actions">
                <button class="eg-spawn-act-btn" data-act="paste">📋 Paste Here</button>
            </div>` : ''}
        ${isManual ? `
            <div class="eg-spawn-menu-sep"></div>
            <div class="eg-spawn-menu-sub">${hasEnemy ? 'Replace enemy:' : 'Choose enemy:'}</div>
            <input class="eg-spawn-search prop-input" type="text" placeholder="Name or ID…" autocomplete="off" spellcheck="false">
            <div class="eg-spawn-results"></div>` : `<div class="eg-spawn-menu-auto-note">Auto placement — positions assigned by array order</div>`}`;

    const r = nodeEl.getBoundingClientRect();
    menu.style.cssText = `position:fixed;z-index:600;left:${r.right + 6}px;top:${r.top}px;`;
    document.body.appendChild(menu);

    if (hasEnemy) {
        menu.querySelector('[data-act="edit"]')?.addEventListener('click', () => {
            menu.remove();
            // Ensure the enemy group prop panel is showing (may have meta selected)
            if (_selection?.enemyGroup !== gi) {
                _selection = { enemyGroup: gi };
                renderPropPanel();
            }
            // Scroll prop panel to this enemy item
            const epItem = document.querySelector(`.ep-enemy-item[data-ei="${ei}"]`);
            if (epItem) {
                epItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                epItem.classList.add('ep-highlight');
                setTimeout(() => epItem.classList.remove('ep-highlight'), 1400);
            }
        });
        menu.querySelector('[data-act="remove"]')?.addEventListener('click', () => {
            if (isManual) delete g.enemies[ei].index;
            menu.remove();
            persistQuest();
            openEnemyGroupSpider(gi);
            if (_selection?.enemyGroup === gi) renderPropPanel();
        });
        menu.querySelector('[data-act="copy"]')?.addEventListener('click', () => {
            _copiedEnemy = JSON.parse(JSON.stringify(en));
            delete _copiedEnemy.index;
            menu.remove();
        });
    }

    menu.querySelector('[data-act="paste"]')?.addEventListener('click', () => {
        if (!_copiedEnemy || !isManual) return;
        if (!g.enemies) g.enemies = [];
        const existEi = posToEi.get(posIdx);
        if (existEi != null) {
            Object.assign(g.enemies[existEi], _copiedEnemy);
            g.enemies[existEi].index = posIdx;
        } else {
            g.enemies.push({ ...JSON.parse(JSON.stringify(_copiedEnemy)), index: posIdx });
        }
        menu.remove();
        persistQuest();
        renderEgPropPanel(gi);
        openEnemyGroupSpider(gi);
    });

    menu.querySelector('[data-act="fill-set"]')?.addEventListener('click', () => {
        if (!hasEnemy) return;
        if (!g.enemies) g.enemies = [];
        sgPositions.forEach(p => {
            const existEi = posToEi.get(p);
            if (existEi != null) {
                // Update existing enemy's id to match
                g.enemies[existEi].enemy_id = en.enemy_id;
            } else {
                // Create a new enemy entry at this position
                g.enemies.push({ enemy_id: en.enemy_id, level: en.level ?? 1, exp: en.exp ?? 0, index: p });
            }
        });
        menu.remove();
        persistQuest();
        renderEgPropPanel(gi);
        openEnemyGroupSpider(gi);
    });

    menu.querySelector('[data-act="clear-set"]')?.addEventListener('click', () => {
        sgPositions.forEach(p => {
            const existEi = posToEi.get(p);
            if (existEi != null) delete g.enemies[existEi].index;
        });
        menu.remove();
        persistQuest();
        renderEgPropPanel(gi);
        openEnemyGroupSpider(gi);
    });

    if (isManual) {
        const searchEl  = menu.querySelector('.eg-spawn-search');
        const resultsEl = menu.querySelector('.eg-spawn-results');
        searchEl?.focus();

        const populateEm = q => {
            const lq = q.toLowerCase();
            const entries = Object.entries(emNames);
            const filtered = lq
                ? entries.filter(([k, v]) => k.includes(lq) || (v.name || '').toLowerCase().includes(lq))
                : entries;
            resultsEl.innerHTML = filtered.slice(0, 12).map(([k, v]) =>
                `<div class="eg-spawn-em-opt" data-emkey="${escAttr(k)}">
                    <span class="eg-spawn-em-name">${escHtml(v.name || k)}</span>
                    <span class="eg-spawn-em-id">${escHtml(k)}</span>
                </div>`).join('');

            resultsEl.querySelectorAll('.eg-spawn-em-opt').forEach(el => {
                el.addEventListener('click', ev => {
                    ev.stopPropagation();
                    const emKey = el.dataset.emkey; // e.g. "em015820"
                    const hexId = '0x' + emKey.replace(/^em/i, '').toUpperCase();
                    if (hasEnemy) {
                        g.enemies[ei].enemy_id = hexId;
                    } else {
                        if (!g.enemies) g.enemies = [];
                        g.enemies.push({ enemy_id: hexId, level: 1, index: posIdx });
                    }
                    menu.remove();
                    persistQuest();
                    openEnemyGroupSpider(gi);
                    if (_selection?.enemyGroup === gi) renderPropPanel();
                    syncEgCard();
                });
            });
        };

        populateEm('');
        searchEl?.addEventListener('input', () => populateEm(searchEl.value));
    }

    const closeMenu = e => {
        if (!menu.contains(e.target) && e.target !== nodeEl) {
            menu.remove();
            document.removeEventListener('click', closeMenu, true);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu, true), 0);
}

function renderSwimlanes() {
    const allProcs = _quest?.processes || [];
    // In focused mode show only the selected process, otherwise show all
    const procs = _focusedProc != null
        ? allProcs.map((p, i) => ({ proc: p, origIdx: i })).filter(x => x.origIdx === _focusedProc)
        : allProcs.map((p, i) => ({ proc: p, origIdx: i }));
    let y = META_CARD_H + META_CARD_GAP;

    procs.forEach(({ proc, origIdx: pi }) => {
        const blocks = proc.blocks || [];
        const laneEl = document.createElement('div');
        laneEl.className = 'swimlane';
        laneEl.dataset.proc = pi;
        laneEl.style.top    = `${y}px`;
        laneEl.style.left   = '0px';
        laneEl.style.height = `${LANE_H}px`;

        // Lane header (vertical label + optional comment)
        const header = document.createElement('div');
        header.className = 'lane-header';
        const idxSpan = document.createElement('span');
        idxSpan.className = 'lane-proc-idx';
        idxSpan.style.color = processColor(pi);
        idxSpan.textContent = `Process ${pi}`;
        header.appendChild(idxSpan);
        if (proc.comment) {
            const cmtSpan = document.createElement('span');
            cmtSpan.className = 'lane-proc-comment';
            cmtSpan.textContent = proc.comment;
            header.appendChild(cmtSpan);
        }
        laneEl.appendChild(header);

        // Lane body
        const body = document.createElement('div');
        body.className = 'lane-body';
        body.dataset.proc = pi;

        // Empty lane — ghost card is appended below after the loop

        blocks.forEach((block, bi) => {
            const node = buildBlockNode(block, pi, bi);
            body.appendChild(node);

            // Arrow spacer + add/paste buttons between blocks (not after the last)
            if (bi < blocks.length - 1) {
            const spacer = document.createElement('div');
            spacer.style.cssText = `width:${BLOCK_GAP}px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;`;
            const addBtn = document.createElement('button');
            addBtn.className = 'add-between-btn';
            addBtn.style.cssText = 'background:none;border:1px dashed #3a3a5a;color:#3a3a5a;border-radius:3px;padding:2px 6px;cursor:pointer;font-size:10px;opacity:0.5;transition:opacity 0.15s;';
            addBtn.textContent = '+';
            addBtn.title = 'Insert block here';
            addBtn.dataset.proc = pi;
            addBtn.dataset.after = bi;
            addBtn.addEventListener('mouseenter', () => addBtn.style.opacity = '1');
            addBtn.addEventListener('mouseleave', () => addBtn.style.opacity = '0.5');
            addBtn.addEventListener('click', e => { e.stopPropagation(); insertBlock(pi, bi + 1); });
            spacer.appendChild(addBtn);
            if (_copiedBlock) {
                const pBtn = document.createElement('button');
                pBtn.style.cssText = 'background:none;border:1px dashed #4a90d9;color:#4a90d9;border-radius:3px;padding:2px 5px;cursor:pointer;font-size:9px;opacity:0.6;transition:opacity 0.15s;';
                pBtn.textContent = '📋';
                pBtn.title = 'Paste copied block here';
                pBtn.addEventListener('mouseenter', () => pBtn.style.opacity = '1');
                pBtn.addEventListener('mouseleave', () => pBtn.style.opacity = '0.6');
                pBtn.addEventListener('click', e => { e.stopPropagation(); pasteBlock(pi, bi + 1); });
                spacer.appendChild(pBtn);
            }
            body.appendChild(spacer);
            } // end if not last
        });

        // Ghost "add" card at end of lane
        const ghost = document.createElement('div');
        ghost.className = 'block-node-ghost';
        ghost.title = 'Add block';
        ghost.innerHTML = `<span class="ghost-plus">+</span>${_copiedBlock ? '<span class="ghost-paste">📋 Paste</span>' : ''}`;
        ghost.addEventListener('click', e => { e.stopPropagation(); insertBlock(pi, blocks.length); });
        if (_copiedBlock) {
            ghost.querySelector('.ghost-paste').addEventListener('click', e => {
                e.stopPropagation();
                pasteBlock(pi, blocks.length);
            });
        }
        body.appendChild(ghost);

        // Divider
        const divider = document.createElement('div');
        divider.className = 'lane-divider';
        body.appendChild(divider);

        laneEl.appendChild(body);
        world.appendChild(laneEl);

        // Measure and advance y after render (approximation; use fixed height)
        y += LANE_H + 10;
    });

    // Set world dimensions to avoid clipping (only visible processes)
    const visibleProcs = _focusedProc != null
        ? [allProcs[_focusedProc]].filter(Boolean)
        : allProcs;
    const maxX = Math.max(...visibleProcs.map(p =>
        LANE_HEADER_W + (p.blocks?.length || 0) * (BLOCK_W + BLOCK_GAP) + BLOCK_GAP + 80
    ), 600);
    world.style.width  = `${maxX}px`;
    world.style.height = `${y + 20}px`;
}


function buildBlockNode(block, pi, bi) {
    const info  = blockTypeInfo(block.type);
    const cat   = BLOCK_CAT[info.cat] ?? BLOCK_CAT.meta;
    const isSel = _selection?.proc === pi && _selection?.block === bi;

    const el = document.createElement('div');
    el.className = 'block-node' + (isSel ? ' selected' : '');
    el.dataset.proc  = pi;
    el.dataset.block = bi;
    el.style.borderColor = cat.color + '88';
    if (block.comment) el.title = block.comment;

    // Header
    const header = document.createElement('div');
    header.className = 'block-node-header';
    header.style.background = cat.color;
    header.innerHTML = `${cat.icon} ${info.label}<span class="block-node-idx">#${bi}</span>`;
    el.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'block-node-body';
    const lines = blockSummary(block);
    if (lines.length === 0) {
        body.innerHTML = '<span style="color:#444466;font-style:italic">no details</span>';
    } else {
        body.innerHTML = lines.map(l =>
            typeof l === 'string'
                ? `<div class="detail-line">${escHtml(l)}</div>`
                : `<div class="detail-line">${l.html}</div>`
        ).join('');
    }
    if (block.comment) {
        body.innerHTML += `<div class="block-comment-line">${escHtml(block.comment)}</div>`;
    }
    // Wire message preview chips in the block summary
    body.querySelectorAll('.msg-preview-chip').forEach(chip => {
        chip.addEventListener('click', e => {
            e.stopPropagation();
            showMsgPreview(chip, parseInt(chip.dataset.serial));
        });
    });
    el.appendChild(body);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'block-node-footer';
    const flagCount  = (block.flags || []).length;
    const chkCount   = (block.check_flags || []).length + (block.set_flags || []).length;
    const checkCmds  = (block.check_commands || []).length;
    const resultCmds = (block.result_commands || []).length;
    footer.innerHTML =
        (flagCount  ? `<span class="block-cmd-badge">🚩 ${flagCount}</span>` : '') +
        (chkCount   ? `<span class="block-cmd-badge">✓ ${chkCount}</span>`  : '') +
        (checkCmds  ? `<span class="block-cmd-badge" title="check_commands">✓ ${checkCmds}cmd</span>` : '') +
        (resultCmds ? `<span class="block-cmd-badge" title="result_commands">→ ${resultCmds}cmd</span>` : '') +
        (block.announce_type ? `<span class="block-announce">${block.announce_type}</span>` : '') +
        `<span style="margin-left:auto;display:flex;gap:3px;">` +
            `<button class="block-reorder-btn" data-proc="${pi}" data-block="${bi}" data-dir="copy" title="Copy block">📋</button>` +
        `</span>`;
    el.appendChild(footer);

    // Reorder / copy buttons — stop propagation so they don't select the block
    footer.querySelectorAll('.block-reorder-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const p = parseInt(btn.dataset.proc), b = parseInt(btn.dataset.block);
            if (btn.dataset.dir === 'left')  moveBlockLeft(p, b);
            else if (btn.dataset.dir === 'right') moveBlockRight(p, b);
            else if (btn.dataset.dir === 'copy')  copyBlock(p, b);
        });
    });

    // Drag start — listen on header so the body/footer reorder buttons don't conflict
    header.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        e.stopPropagation();
        _drag = {
            srcProc: pi, srcBlock: bi,
            startX: e.clientX, startY: e.clientY,
            live: false, ghost: null, placeholder: null,
            overProc: null, insertAt: null,
        };
    });

    // Click handler
    el.addEventListener('click', e => { e.stopPropagation(); selectBlock(pi, bi); });

    // Dependency highlight on hover
    el.addEventListener('mouseenter', () => {
        const { upstream, downstream } = findFlagDeps(pi, bi);
        if (upstream.size === 0 && downstream.size === 0) return;
        const self = `${pi}:${bi}`;
        world.querySelectorAll('.block-node').forEach(n => {
            const key = `${n.dataset.proc}:${n.dataset.block}`;
            if (key === self) return;
            if (upstream.has(key))        n.classList.add('dep-upstream');
            else if (downstream.has(key)) n.classList.add('dep-downstream');
        });
        document.getElementById('dep-legend')?.classList.add('visible');
    });
    el.addEventListener('mouseleave', clearDepHighlights);

    return el;
}

// Return the bounding rect of a block node in world-space coordinates.
// getBoundingClientRect() is in screen space; dividing by _cam.z converts back.
function blockWorldRect(pi, bi) {
    const el = world.querySelector(`.block-node[data-proc="${pi}"][data-block="${bi}"]`);
    if (!el) return null;
    const wr = world.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const z  = _cam.z;
    return {
        left:   (er.left   - wr.left) / z,
        top:    (er.top    - wr.top)  / z,
        right:  (er.right  - wr.left) / z,
        bottom: (er.bottom - wr.top)  / z,
        width:  er.width  / z,
        height: er.height / z,
    };
}

function renderArrows() {
    if (!_quest) return;
    const procs = _quest.processes || [];

    procs.forEach((proc, pi) => {
        const blocks = proc.blocks || [];
        blocks.forEach((_, bi) => {
            if (bi >= blocks.length - 1) return;

            const rA = blockWorldRect(pi, bi);
            const rB = blockWorldRect(pi, bi + 1);
            if (!rA || !rB) return;

            // Right-centre of A → Left-centre of B
            const x1 = rA.right;
            const y1 = rA.top + rA.height / 2;
            const x2 = rB.left;
            const y2 = rB.top + rB.height / 2;
            const mx = (x1 + x2) / 2;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('class', 'conn-arrow');
            path.setAttribute('d', `M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`);
            svgLayer.appendChild(path);
        });
    });
}

function processColor(idx) {
    const colors = ['#4a90d9','#4caf50','#f5a623','#d96a4a','#9b59b6','#1abc9c','#e74c3c','#3498db'];
    return colors[idx % colors.length];
}

function ocLabel(oc) {
    const areaName = id => (QUEST_AREA_IDS.find(([i]) => i === id) ?? [id, `Area ${id}`])[1];
    switch (oc.type) {
        case 'MinimumLevel':         return `Lv ≥${oc.Param1}`;
        case 'MinimumJobLevel':      return `Job Lv ≥${oc.Param1}`;
        case 'MinimumVocationLevel': return `Vocation ${oc.Param1} Lv ≥${oc.Param2}`;
        case 'Solo':                 return 'Solo';
        case 'SoloWithPawns':        return 'Solo+Pawns';
        case 'SoloWithPawnCount':    return `Solo (≤${oc.Param1} pawns)`;
        case 'PartnerPawnInParty':   return 'Partner Pawn';
        case 'ArisenTactics':        return 'Arisen Tactics';
        case 'PrepareEquipment':     return 'Prepare Equip';
        case 'MainQuestCompleted':   return `Main q${oc.Param1}`;
        case 'ClearPersonalQuest':   return `Personal q${oc.Param1}`;
        case 'ClearExtremeMission':  return `Extreme q${oc.Param1}`;
        case 'ClearWorldQuest':      return `World q${oc.Param1}`;
        case 'ClearSubstory':        return `Substory ${oc.Param1}`;
        case 'AreaRank':             return `${areaName(oc.Param1)} ★${oc.Param2}`;
        case 'ItemRank':             return `Item Rank ${oc.Param1}`;
        case 'PocessesItem':         return `Has item ${oc.Param1}`;
        default:                     return oc.type;
    }
}

function rewardLabel(r) {
    switch (r.type) {
        case 'exp':    return `${r.amount} XP`;
        case 'ap':     return `${r.amount} AP`;
        case 'pp':     return `${r.amount} PP`;
        case 'jp':     return `${r.amount} JP`;
        case 'wallet': return r.wallet_type === 'Gold' ? `${r.amount} G` : `${r.amount} RP`;
        case 'fixed':  { const n=(r.loot_pool||[]).length; return `📦 ${n} item${n===1?'':'s'}`; }
        case 'select': return `🎁 Choose 1 of ${(r.loot_pool||[]).length}`;
        case 'random': { const n=(r.loot_pool||[]).length; return `🎲 ${n} item${n===1?'':'s'}`; }
        default:       return r.type;
    }
}

function metaCardOcHtml(q) {
    const ocs = q.order_conditions || [];
    if (!ocs.length) return '';
    return `<div class="meta-card-oc">${ocs.map(oc =>
        `<span class="mc-oc-chip">${escHtml(ocLabel(oc))}</span>`
    ).join('')}</div>`;
}

function metaCardCrHtml(q) {
    const crs = (q.contents_release || []).filter(cr => cr.type && cr.type !== 'None');
    if (!crs.length) return '';
    return `<div class="meta-card-cr">${crs.map(cr =>
        `<span class="mc-cr-chip" title="🔓 Unlocked on quest completion&#10;${escAttr(cr.tutorial_id ? splitEnum(cr.type) + ' + ' + splitEnum(cr.tutorial_id) : splitEnum(cr.type))}">🔓 ${escHtml(splitEnum(cr.type))}</span>`
    ).join('')}</div>`;
}

function metaCardRewardsHtml(q) {
    const rws = q.rewards || [];
    if (!rws.length) return '';
    const rewardTooltip = r => {
        switch (r.type) {
            case 'exp':    return 'Experience points';
            case 'wallet': return r.wallet_type === 'Gold' ? 'Gold (always given)' : 'Rift Points (always given)';
            case 'ap':     return 'AP (always given)';
            case 'pp':     return 'PP (always given)';
            case 'jp':     return 'JP (always given)';
            case 'fixed':  return 'Fixed items — always given';
            case 'select': return 'Select reward — player chooses one';
            case 'random': return 'Random items — drawn from pool';
            default:       return r.type;
        }
    };
    return `<div class="meta-card-rewards">${rws.map(r =>
        `<span class="mc-rw-chip mc-rw-${r.type}${r.type==='wallet'&&r.wallet_type==='RiftPoints'?'-rp':''}" title="${escAttr(rewardTooltip(r))}">${escHtml(rewardLabel(r))}</span>`
    ).join('')}</div>`;
}

function questTypeTheme(type) {
    switch (type) {
        case 'Main':
            return { border: '#802A28', headerBg: '#4A1715', headerText: '#D07878' };
        case 'World':
            return { border: '#21506A', headerBg: '#152F3E', headerText: '#60A8C8' };
        case 'WorldManage':
            return { border: '#4A3070', headerBg: '#28183E', headerText: '#9070C0' };
        case 'Tutorial':
        case 'Board':
        case 'Limited':
            return { border: '#3C7042', headerBg: '#23422A', headerText: '#70C080' };
        case 'ExtremeMission':
        case 'CycleContents':
        case 'CycleContentsQuest':
            return { border: '#B8940A', headerBg: '#1A1500', headerText: '#F0C040' };
        case 'WildHunt':
            return { border: '#7A3558', headerBg: '#3E1A30', headerText: '#C870A0' };
        default:
            return { border: '#5a4a2a', headerBg: '#3a2e10', headerText: '#c8a83a' };
    }
}

function applyMetaCardTheme(card, type) {
    const t = questTypeTheme(type);
    card.style.setProperty('--mc-border',      t.border);
    card.style.setProperty('--mc-header-bg',   t.headerBg);
    card.style.setProperty('--mc-header-text', t.headerText);
}

function scrollToProcess(pi) {
    if (_focusedProc != null) {
        // In focused mode the lane is always the first (and only) visible one
        _cam.y = 40;
        applyCamera();
        return;
    }
    // Scroll canvas camera so lane header is visible
    _cam.y = -(META_CARD_H + META_CARD_GAP + pi * (LANE_H + 10)) * _cam.z + 40;
    applyCamera();
}

// ── Block reorder / move / copy-paste ─────────────────────────────────────────
function moveBlockLeft(pi, bi) {
    if (!_quest || bi === 0) return;
    const blocks = _quest.processes[pi].blocks;
    [blocks[bi - 1], blocks[bi]] = [blocks[bi], blocks[bi - 1]];
    _selection.block = bi - 1;
    render(); renderPropPanel(); persistQuest();
}

function moveBlockRight(pi, bi) {
    if (!_quest) return;
    const blocks = _quest.processes[pi].blocks;
    if (bi >= blocks.length - 1) return;
    [blocks[bi], blocks[bi + 1]] = [blocks[bi + 1], blocks[bi]];
    _selection.block = bi + 1;
    render(); renderPropPanel(); persistQuest();
}

function moveBlockToProcess(pi, bi, targetPi) {
    if (!_quest || pi === targetPi) return;
    const [block] = _quest.processes[pi].blocks.splice(bi, 1);
    _quest.processes[targetPi].blocks.push(block);
    _selection = { proc: targetPi, block: _quest.processes[targetPi].blocks.length - 1 };
    render(); renderPropPanel(); persistQuest();
}

function copyBlock(pi, bi) {
    if (!_quest) return;
    _copiedBlock = JSON.parse(JSON.stringify(_quest.processes[pi].blocks[bi]));
    render(); renderPropPanel(); // refresh paste affordances everywhere
}

function pasteBlock(pi, insertAt) {
    if (!_copiedBlock || !_quest) return;
    const clone = normalizeBlock(JSON.parse(JSON.stringify(_copiedBlock)));
    _quest.processes[pi].blocks.splice(insertAt, 0, clone);
    _selection = { proc: pi, block: insertAt };
    render(); renderPropPanel(); persistQuest();
}

// ── Selection ─────────────────────────────────────────────────────────────────
function selectBlock(pi, bi) {
    closeEnemyGroupSpider();
    _selection = { proc: pi, block: bi };
    world.querySelectorAll('.meta-card.selected').forEach(el => el.classList.remove('selected'));
    renderPropPanel();
    // Re-render nodes to update selection highlight without full re-render
    world.querySelectorAll('.block-node').forEach(el => {
        const ep = parseInt(el.dataset.proc);
        const eb = parseInt(el.dataset.block);
        el.classList.toggle('selected', ep === pi && eb === bi);
    });
    renderSidebar();
}

function clearSelection() {
    _selection = null;
    closeEnemyGroupSpider();
    renderPropPanel();
    world.querySelectorAll('.block-node.selected,.meta-card.selected')
         .forEach(el => el.classList.remove('selected'));
    renderSidebar();
}

function buildOcItemHtml(oc, i) {
    const params = OC_PARAMS[oc.type] || [];
    const paramsHtml = params.map((p, pi) => {
        const pkName = pi === 0 ? 'Param1' : 'Param2';
        const val = oc[pkName] ?? 0;
        if (p.type === 'area') {
            return `<div class="cmd-param">
                <span class="cmd-param-label">${escHtml(p.label)}</span>
                <select data-oc-idx="${i}" data-oc-field="${pkName}" class="prop-select" style="flex:1">
                    ${QUEST_AREA_IDS.map(([id,name]) =>
                        `<option value="${id}" ${val===id?'selected':''}>${id} – ${escHtml(name)}</option>`
                    ).join('')}
                </select>
            </div>`;
        }
        return `<div class="cmd-param">
            <span class="cmd-param-label">${escHtml(p.label)}</span>
            <input type="number" data-oc-idx="${i}" data-oc-field="${pkName}" value="${val}">
        </div>`;
    }).join('');
    return `<div class="cmd-item" data-oc-idx="${i}">
        <div class="cmd-item-header">
            <select data-oc-type="${i}" style="flex:1;background:var(--bg);border:1px solid var(--border2);border-radius:3px;color:var(--text);padding:2px 4px;font-size:11px;">
                ${OC_TYPES.map(t => `<option value="${t}" ${t===oc.type?'selected':''}>${escHtml(splitEnum(t))}</option>`).join('')}
            </select>
            <button class="cmd-delete-btn" data-del-oc="${i}" title="Remove">✕</button>
        </div>
        <div class="cmd-params">${paramsHtml}</div>
    </div>`;
}

function buildCrItemHtml(cr, i) {
    const tutOpts = `<option value="">(none)</option>` +
        TUTORIAL_ID_TYPES.filter(t => t !== 'None').map(t =>
            `<option value="${t}" ${t === cr.tutorial_id ? 'selected' : ''}>${escHtml(splitEnum(t))}</option>`
        ).join('');
    return `<div class="cmd-item" data-cr-idx="${i}">
        <div class="cmd-item-header">
            <select class="prop-select" data-cr-type="${i}" style="flex:1">
                ${CONTENTS_RELEASE_TYPES.map(t =>
                    `<option value="${t}" ${t === cr.type ? 'selected' : ''}>${escHtml(splitEnum(t))}</option>`
                ).join('')}
            </select>
            <button class="cmd-delete-btn" data-del-cr="${i}" title="Remove">✕</button>
        </div>
        <div class="cmd-params">
            <div class="cmd-param">
                <span class="cmd-param-label">Tutorial</span>
                <select class="prop-select" data-cr-tutorial="${i}" style="flex:1;font-size:10px">${tutOpts}</select>
            </div>
        </div>
    </div>`;
}

function buildRewardItemHtml(r, i) {
    let fieldsHtml = '';
    if (r.type === 'wallet') {
        fieldsHtml = `<div class="cmd-params">
            <div class="cmd-param">
                <span class="cmd-param-label">Wallet</span>
                <select data-rw-idx="${i}" data-rw-field="wallet_type" class="prop-select" style="flex:1">
                    ${WALLET_TYPES.map(t => `<option value="${t}" ${t===r.wallet_type?'selected':''}>${t}</option>`).join('')}
                </select>
            </div>
            <div class="cmd-param">
                <span class="cmd-param-label">Amount</span>
                <input type="number" data-rw-idx="${i}" data-rw-field="amount" value="${r.amount ?? 0}">
            </div>
        </div>`;
    } else if (['exp','ap','pp','jp'].includes(r.type)) {
        fieldsHtml = `<div class="cmd-params">
            <div class="cmd-param">
                <span class="cmd-param-label">Amount</span>
                <input type="number" data-rw-idx="${i}" data-rw-field="amount" value="${r.amount ?? 0}">
            </div>
        </div>`;
    } else if (['fixed','select','random'].includes(r.type)) {
        const pool = r.loot_pool || [];
        const rowsHtml = pool.map((item, ii) =>
            `<div class="loot-row" data-rw-idx="${i}" data-loot-idx="${ii}">
                <span class="item-picker-mount" data-rw-idx="${i}" data-loot-idx="${ii}" data-val="${item.item_id ?? ''}"></span>
                <input type="number" class="prop-input" data-rw-idx="${i}" data-loot-idx="${ii}" data-loot-field="num"
                    value="${item.num ?? 1}" min="1" title="Quantity">
                <button class="cmd-delete-btn" data-del-loot-rw="${i}" data-del-loot-idx="${ii}" title="Remove item">✕</button>
            </div>`
        ).join('');
        fieldsHtml = `<div class="loot-pool-list" data-rw-idx="${i}">
            ${rowsHtml}
            <button class="add-cmd-btn" data-add-loot="${i}" style="margin-top:4px;width:100%">＋ Add Item</button>
        </div>`;
    }

    return `<div class="cmd-item" data-rw-idx="${i}">
        <div class="cmd-item-header">
            <select data-rw-type="${i}" style="flex:1;background:var(--bg);border:1px solid var(--border2);border-radius:3px;color:var(--text);padding:2px 4px;font-size:11px;">
                ${REWARD_TYPES.map(t => `<option value="${t}" ${t===r.type?'selected':''}>${t}</option>`).join('')}
            </select>
            <button class="cmd-delete-btn" data-del-rw="${i}" title="Remove">✕</button>
        </div>
        ${fieldsHtml}
    </div>`;
}

function renderMetaPropPanel() {
    const q = _quest;
    propHeaderSub.textContent = 'Quest Meta';
    propDelete.style.display = 'none';

    const boolRow = (id, label, val) =>
        `<div class="prop-check-row">
            <input type="checkbox" id="${id}" ${val ? 'checked' : ''}>
            <label for="${id}">${label}</label>
        </div>`;

    propBody.innerHTML = `
        <div class="prop-section">
            <div class="prop-section-title">Identity</div>
            <div class="prop-row"><label class="prop-label">Quest ID</label>
                <input type="number" class="prop-input" id="mp-quest-id" value="${q.quest_id ?? ''}"></div>
            <div class="prop-row"><label class="prop-label">Variant</label>
                <input type="number" class="prop-input" id="mp-variant" value="${q.variant_index ?? 0}" min="0"></div>
            <div class="prop-row"><label class="prop-label">Type</label>
                <select class="prop-select" id="mp-type">
                    ${QUEST_TYPES.map(t => `<option value="${t}" ${t===q.type?'selected':''}>${t}</option>`).join('')}
                </select></div>
            <div class="prop-row"><label class="prop-label">Name</label>
                <input type="text" class="prop-input" id="mp-comment" value="${escAttr(q.comment ?? '')}"></div>
        </div>
        <div class="prop-section">
            <div class="prop-section-title">Progression</div>
            <div class="prop-row"><label class="prop-label">Base Level</label>
                <input type="number" class="prop-input" id="mp-base-level" value="${q.base_level ?? ''}"></div>
            <div class="prop-row"><label class="prop-label">Min Item Rank</label>
                <input type="number" class="prop-input" id="mp-min-rank" value="${q.minimum_item_rank ?? 0}"></div>
            <div class="prop-row"><label class="prop-label">Next Quest ID</label>
                <input type="number" class="prop-input" id="mp-next-quest" value="${q.next_quest ?? ''}"></div>
        </div>
        <div class="prop-section">
            <div class="prop-section-title">World</div>
            <div class="prop-row"><label class="prop-label">Area</label>
                <select class="prop-select" id="mp-area-id">
                    <option value="">(none)</option>
                    ${AREA_IDS.map(([val, label]) => `<option value="${val}" ${val===q.area_id?'selected':''}>${escHtml(label)}</option>`).join('')}
                </select></div>
            ${['Tutorial','Substory'].includes(q.type) ? `
            <div class="prop-row"><label class="prop-label">Stage</label>
                <span id="mp-stage-picker-mount" data-val="${q.stage_id?.id ?? ''}" style="flex:1"></span>
            </div>` : ''}
            ${q.type === 'World' ? `
            <div class="prop-row"><label class="prop-label">News Image</label>
                <select class="prop-select" id="mp-news-image">
                    <option value="">(none)</option>
                    ${newsImages.map(id => `<option value="${id}" ${id===q.news_image?'selected':''}>${id}</option>`).join('')}
                </select></div>` : ''}
            ${q.type === 'WildHunt' ? `
            <div class="prop-row"><label class="prop-label">Order Background</label>
                <select class="prop-select" id="mp-order-bg-id">
                    <option value="">(none)</option>
                    ${wildHuntImages.map(id => `<option value="${id}" ${id===q.order_background_id?'selected':''}>${id}</option>`).join('')}
                </select>
                ${q.order_background_id != null && wildHuntImages.includes(q.order_background_id) ? `<button class="img-lightbox-btn" id="mp-wh-lightbox" title="View full image">🔍</button>` : ''}
            </div>` : ''}
            ${q.type === 'Substory' ? (() => {
                const grp = SUBSTORY_GROUPS.find(g => g.id === q.substory_group_id) ?? SUBSTORY_GROUPS[0];
                return `
            <div class="prop-row"><label class="prop-label">Group</label>
                <select class="prop-select" id="mp-substory-group">
                    ${SUBSTORY_GROUPS.map(g => `<option value="${g.id}" ${g.id===q.substory_group_id?'selected':''}>${escHtml(g.name)} #${g.npcId}</option>`).join('')}
                </select></div>
            <div class="prop-row"><label class="prop-label">Sequence</label>
                <select class="prop-select" id="mp-substory-seq">
                    ${grp.seqs.map(s => `<option value="${s}" ${s===q.substory_sequence_num?'selected':''}>seq ${s}</option>`).join('')}
                </select></div>`;
            })() : ''}
            ${q.type === 'Main' ? `<div class="prop-row" style="opacity:0.6;font-size:11px;color:var(--text2)">Image auto-derived from Quest ID</div>` : ''}
            <img id="mp-img-preview" class="prop-news-preview${questImagePath(q) ? '' : ' prop-news-hidden'}"
                src="${questImagePath(q) ?? ''}" alt="Image preview">
        </div>
        <div class="prop-section">
            <div class="prop-section-title">Flags</div>
            ${boolRow('mp-enabled',   'Enabled',                q.enabled   ?? true)}
            ${boolRow('mp-discoverable', 'Discoverable',        q.discoverable ?? true)}
            ${boolRow('mp-important', 'Is Important',           q.is_important ?? false)}
            ${isCancelApplicable(q.type)
                ? boolRow('mp-cancel', 'Enable Cancel', q.enable_cancel ?? defaultEnableCancel(q.type))
                : `<div class="prop-check-row" style="opacity:0.4">
                    <input type="checkbox" id="mp-cancel" disabled>
                    <label for="mp-cancel">Enable Cancel (n/a for this type)</label>
                   </div>`}
            ${boolRow('mp-override-spawn', 'Override Enemy Spawn', q.override_enemy_spawn ?? false)}
            ${boolRow('mp-reset-player',   'Reset Player After',   q.reset_player_after_quest ?? false)}
        </div>
        <div class="prop-section">
            <div class="prop-section-title">Order Conditions</div>
            <div id="mp-oc-list">
                ${(q.order_conditions || []).map((oc, i) => buildOcItemHtml(oc, i)).join('')}
            </div>
            <div class="add-cmd-row" style="margin-top:6px">
                <select id="mp-oc-add-type" style="flex:1;background:var(--bg);border:1px solid var(--border2);border-radius:3px;color:var(--text);padding:2px 4px;font-size:11px;">
                    ${OC_TYPES.map(t => `<option value="${t}">${escHtml(splitEnum(t))}</option>`).join('')}
                </select>
                <button class="add-cmd-btn" id="mp-add-oc">＋ Add</button>
            </div>
        </div>
        <div class="prop-section">
            <div class="prop-section-title">Rewards</div>
            <div id="mp-rewards-list">
                ${(q.rewards || []).map((r, i) => buildRewardItemHtml(r, i)).join('')}
            </div>
            <div class="add-cmd-row" style="margin-top:6px">
                <select id="mp-rw-add-type" style="flex:1;background:var(--bg);border:1px solid var(--border2);border-radius:3px;color:var(--text);padding:2px 4px;font-size:11px;">
                    ${REWARD_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
                </select>
                <button class="add-cmd-btn" id="mp-add-rw">＋ Add</button>
            </div>
        </div>
        <div class="prop-section">
            <div class="prop-section-title">Contents Release
                <span style="font-weight:400;font-size:9px;margin-left:6px">unlocked on quest completion</span>
            </div>
            <div id="mp-cr-list">
                ${(q.contents_release || []).map((cr, i) => buildCrItemHtml(cr, i)).join('')}
            </div>
            <button class="add-cmd-btn" id="mp-add-cr" style="margin-top:4px;width:100%">＋ Add Release</button>
        </div>
        `;

    const num = id => { const v = propBody.querySelector(id)?.value; return v !== '' ? parseInt(v) : undefined; };
    const wire = (id, fn) => propBody.querySelector(id)?.addEventListener('change', fn);

    wire('#mp-quest-id',    () => { q.quest_id       = num('#mp-quest-id');    syncMetaCard(); });
    wire('#mp-variant',     () => { q.variant_index  = num('#mp-variant') ?? 0; syncMetaCard(); });
    wire('#mp-type',        () => { q.type = propBody.querySelector('#mp-type').value; syncMetaCard(); renderMetaPropPanel(); });
    wire('#mp-comment',     () => { q.comment        = propBody.querySelector('#mp-comment').value || undefined; syncMetaCard(); });
    wire('#mp-base-level',  () => { q.base_level     = num('#mp-base-level');  syncMetaCard(); });
    wire('#mp-min-rank',    () => { q.minimum_item_rank = num('#mp-min-rank') ?? 0; syncMetaCard(); });
    wire('#mp-next-quest',  () => { const v = num('#mp-next-quest'); v != null ? q.next_quest = v : delete q.next_quest; syncMetaCard(); });
    wire('#mp-area-id',     () => { q.area_id        = propBody.querySelector('#mp-area-id').value || undefined; syncMetaCard(); });
    const mpStageMnt = propBody.querySelector('#mp-stage-picker-mount');
    if (mpStageMnt) {
        const currentId = mpStageMnt.dataset.val !== '' ? parseInt(mpStageMnt.dataset.val) : undefined;
        mpStageMnt.replaceWith(buildStagePicker(currentId, newId => {
            if (!q.stage_id) q.stage_id = {};
            q.stage_id.id = newId;
            syncMetaCard(); persistQuest();
        }));
    }
    // Ensure substory defaults are set the moment the panel opens, then sync the canvas card
    if (q.type === 'Substory') {
        let needsSync = false;
        if (q.substory_group_id == null) { q.substory_group_id = SUBSTORY_GROUPS[0].id; needsSync = true; }
        if (q.substory_sequence_num == null) { q.substory_sequence_num = (SUBSTORY_GROUPS.find(g => g.id === q.substory_group_id) ?? SUBSTORY_GROUPS[0]).seqs[0] ?? 0; needsSync = true; }
        if (needsSync) syncMetaCard();
    }

    function updateImgPreview() {
        const preview = propBody.querySelector('#mp-img-preview');
        if (!preview) return;
        const src = questImagePath(q);
        if (src) { preview.src = src; preview.classList.remove('prop-news-hidden'); }
        else      { preview.src = ''; preview.classList.add('prop-news-hidden'); }
    }
    wire('#mp-news-image', () => {
        const sel = propBody.querySelector('#mp-news-image');
        const val = sel.value !== '' ? parseInt(sel.value) : undefined;
        if (val != null) q.news_image = val; else delete q.news_image;
        updateImgPreview();
        syncMetaCard();
    });
    wire('#mp-order-bg-id', () => {
        const val = propBody.querySelector('#mp-order-bg-id')?.value;
        q.order_background_id = val !== '' && val != null ? parseInt(val) : undefined;
        updateImgPreview();
        syncMetaCard();
        renderMetaPropPanel(); // refresh lightbox chip visibility
    });
    propBody.querySelector('#mp-wh-lightbox')?.addEventListener('click', () => {
        const src = questImagePath(q);
        if (src) openImgLightbox(src);
    });
    propBody.querySelector('#mp-substory-group')?.addEventListener('change', () => {
        const sel = propBody.querySelector('#mp-substory-group');
        q.substory_group_id = parseInt(sel.value);
        const grp = SUBSTORY_GROUPS.find(g => g.id === q.substory_group_id);
        q.substory_sequence_num = grp?.seqs[0] ?? 0; // default to first seq of new group
        renderPropPanel();
        syncMetaCard();
    });
    wire('#mp-substory-seq', () => {
        const sel = propBody.querySelector('#mp-substory-seq');
        q.substory_sequence_num = sel ? parseInt(sel.value) : undefined;
        updateImgPreview();
        syncMetaCard();
    });

    [['#mp-enabled','enabled',true],['#mp-discoverable','discoverable',true],
     ['#mp-important','is_important',false],
     ['#mp-cancel','enable_cancel', defaultEnableCancel(q.type)],
     ['#mp-override-spawn','override_enemy_spawn',false],
     ['#mp-reset-player','reset_player_after_quest',false]
    ].forEach(([id, key, def]) => {
        propBody.querySelector(id)?.addEventListener('change', e => {
            e.target.checked !== def ? q[key] = e.target.checked : delete q[key];
            persistQuest();
            syncMetaCard();
        });
    });

    // ── Order Conditions wiring ───────────────────────────────────────────────
    const ocList = propBody.querySelector('#mp-oc-list');

    propBody.querySelector('#mp-add-oc')?.addEventListener('click', () => {
        if (!q.order_conditions) q.order_conditions = [];
        const type = propBody.querySelector('#mp-oc-add-type')?.value || 'MinimumLevel';
        q.order_conditions.push({ type });
        renderMetaPropPanel();
        persistQuest();
        syncMetaCard();
    });

    ocList?.querySelectorAll('[data-del-oc]').forEach(btn => {
        btn.addEventListener('click', () => {
            q.order_conditions?.splice(parseInt(btn.dataset.delOc), 1);
            renderMetaPropPanel();
            persistQuest();
            syncMetaCard();
        });
    });

    ocList?.querySelectorAll('[data-oc-type]').forEach(sel => {
        sel.addEventListener('change', () => {
            const i = parseInt(sel.dataset.ocType);
            if (!q.order_conditions?.[i]) return;
            q.order_conditions[i] = { type: sel.value };
            renderMetaPropPanel();
            persistQuest();
            syncMetaCard();
        });
    });

    ocList?.querySelectorAll('[data-oc-field]').forEach(inp => {
        inp.addEventListener('change', () => {
            const i = parseInt(inp.dataset.ocIdx);
            const field = inp.dataset.ocField;
            if (!q.order_conditions?.[i]) return;
            q.order_conditions[i][field] = parseInt(inp.value) || 0;
            persistQuest();
            syncMetaCard();
        });
    });

    // ── Rewards wiring ────────────────────────────────────────────────────────
    const rwList = propBody.querySelector('#mp-rewards-list');

    propBody.querySelector('#mp-add-rw')?.addEventListener('click', () => {
        if (!q.rewards) q.rewards = [];
        const type = propBody.querySelector('#mp-rw-add-type')?.value || 'exp';
        const newRw = { type };
        if (['exp','wallet','ap','pp','jp'].includes(type)) newRw.amount = 0;
        if (type === 'wallet') newRw.wallet_type = 'Gold';
        if (['fixed','select','random'].includes(type)) newRw.loot_pool = [];
        q.rewards.push(newRw);
        renderMetaPropPanel();
        persistQuest();
        syncMetaCard();
    });

    rwList?.querySelectorAll('[data-del-rw]').forEach(btn => {
        btn.addEventListener('click', () => {
            q.rewards?.splice(parseInt(btn.dataset.delRw), 1);
            renderMetaPropPanel();
            persistQuest();
            syncMetaCard();
        });
    });

    rwList?.querySelectorAll('[data-rw-type]').forEach(sel => {
        sel.addEventListener('change', () => {
            const i = parseInt(sel.dataset.rwType);
            if (!q.rewards?.[i]) return;
            const type = sel.value;
            const newRw = { type };
            if (['exp','wallet','ap','pp','jp'].includes(type)) newRw.amount = 0;
            if (type === 'wallet') newRw.wallet_type = 'Gold';
            if (['fixed','select','random'].includes(type)) newRw.loot_pool = [];
            q.rewards[i] = newRw;
            renderMetaPropPanel();
            persistQuest();
            syncMetaCard();
        });
    });

    rwList?.querySelectorAll('[data-rw-field]').forEach(inp => {
        inp.addEventListener('change', () => {
            const i   = parseInt(inp.dataset.rwIdx);
            const field = inp.dataset.rwField;
            if (!q.rewards?.[i]) return;
            if (field === 'wallet_type') q.rewards[i][field] = inp.value;
            else q.rewards[i][field] = parseInt(inp.value) || 0;
            persistQuest();
            syncMetaCard();
        });
    });

    rwList?.querySelectorAll('[data-add-loot]').forEach(btn => {
        btn.addEventListener('click', () => {
            const i = parseInt(btn.dataset.addLoot);
            if (!q.rewards?.[i]?.loot_pool) return;
            q.rewards[i].loot_pool.push({ item_id: 0, num: 1 });
            renderMetaPropPanel();
            persistQuest();
            syncMetaCard();
        });
    });

    rwList?.querySelectorAll('[data-del-loot-rw]').forEach(btn => {
        btn.addEventListener('click', () => {
            const i  = parseInt(btn.dataset.delLootRw);
            const ii = parseInt(btn.dataset.delLootIdx);
            q.rewards?.[i]?.loot_pool?.splice(ii, 1);
            renderMetaPropPanel();
            persistQuest();
            syncMetaCard();
        });
    });

    // Wire num inputs in loot rows
    rwList?.querySelectorAll('[data-loot-field="num"]').forEach(inp => {
        inp.addEventListener('change', () => {
            const i  = parseInt(inp.dataset.rwIdx);
            const ii = parseInt(inp.dataset.lootIdx);
            const item = q.rewards?.[i]?.loot_pool?.[ii];
            if (!item) return;
            item.num = parseInt(inp.value) || 1;
            persistQuest();
        });
    });

    // Mount item pickers in loot rows
    rwList?.querySelectorAll('.item-picker-mount').forEach(mount => {
        const i   = parseInt(mount.dataset.rwIdx);
        const ii  = parseInt(mount.dataset.lootIdx);
        const val = mount.dataset.val !== '' ? parseInt(mount.dataset.val) : null;
        const picker = buildItemPicker(val, id => {
            const item = q.rewards?.[i]?.loot_pool?.[ii];
            if (item) { item.item_id = id; persistQuest(); }
        });
        mount.replaceWith(picker);
    });

    // ── Source files link / load button ──────────────────────────────────────

    // ── Contents Release wiring (quest level) ────────────────────────────────
    const crList = propBody.querySelector('#mp-cr-list');

    propBody.querySelector('#mp-add-cr')?.addEventListener('click', () => {
        if (!q.contents_release) q.contents_release = [];
        q.contents_release.push({ type: 'None' });
        renderMetaPropPanel();
        persistQuest();
        syncMetaCard();
    });

    crList?.querySelectorAll('[data-del-cr]').forEach(btn => {
        btn.addEventListener('click', () => {
            q.contents_release?.splice(parseInt(btn.dataset.delCr), 1);
            renderMetaPropPanel();
            persistQuest();
            syncMetaCard();
        });
    });

    crList?.querySelectorAll('[data-cr-type]').forEach(sel => {
        sel.addEventListener('change', () => {
            const i = parseInt(sel.dataset.crType);
            if (!q.contents_release?.[i]) return;
            q.contents_release[i].type = sel.value;
            persistQuest();
            syncMetaCard();
        });
    });

    crList?.querySelectorAll('[data-cr-tutorial]').forEach(sel => {
        sel.addEventListener('change', () => {
            const i = parseInt(sel.dataset.crTutorial);
            if (!q.contents_release?.[i]) return;
            if (sel.value) q.contents_release[i].tutorial_id = sel.value;
            else delete q.contents_release[i].tutorial_id;
            persistQuest();
        });
    });
}

function syncMetaCard() {
    // Update the canvas meta card and toolbar displays without full re-render
    const card = world.querySelector('.meta-card');
    if (card) {
        const q = _quest;
        applyMetaCardTheme(card, q.type);
        card.querySelector('.meta-card-header').innerHTML =
            `<span>⚙</span><span>Quest ${q.quest_id ?? '???'}</span>` +
            `<span class="meta-card-variant">v${q.variant_index ?? 0}</span>` +
            ((q.enabled ?? true) === false ? `<span class="meta-card-disabled-chip" title="Quest is disabled — will not appear in-game">⛔ Disabled</span>` : '') +
            `<span class="meta-card-type">${q.type ?? ''}</span>`;
        card.querySelector('.meta-card-name').textContent = q.comment ?? '(unnamed)';
        // Portrait (Substory only)
        const identityEl = card.querySelector('.meta-card-identity');
        if (identityEl) {
            let portrait = identityEl.querySelector('.meta-card-portrait');
            const portraitSrc = q.type === 'Substory' && q.substory_group_id != null
                ? substoryPortraitPath(q.substory_group_id) : null;
            if (portraitSrc) {
                if (!portrait) {
                    portrait = document.createElement('img');
                    portrait.className = 'meta-card-portrait';
                    portrait.alt = 'NPC portrait';
                    identityEl.appendChild(portrait);
                }
                portrait.src = portraitSrc;
            } else if (portrait) {
                portrait.remove();
            }
        }
        card.querySelector('.meta-card-details').innerHTML =
            (q.base_level       != null ? `<span>Lv ${q.base_level}</span>` : '') +
            (q.minimum_item_rank > 0    ? `<span>IR ${q.minimum_item_rank}+</span>` : '') +
            (q.area_id          ? `<span>${escHtml(areaIdLabel(q.area_id))}</span>` : '') +
            (q.next_quest ? `<span>→ q${String(q.next_quest).padStart(8,'0')}</span>` : '');
        // Update order conditions and rewards chips
        const body = card.querySelector('.meta-card-body');
        const wrap0 = card.querySelector('.meta-card-img-wrap');
        ['meta-card-oc', 'meta-card-rewards', 'meta-card-cr'].forEach(cls => card.querySelector(`.${cls}`)?.remove());
        const tmpOc = document.createElement('template'); tmpOc.innerHTML = metaCardOcHtml(q) + metaCardRewardsHtml(q) + metaCardCrHtml(q);
        [...tmpOc.content.childNodes].forEach(n => body.insertBefore(n, wrap0 || null));
        // Update quest image
        const imgSrc = questImagePath(q);
        let wrap = card.querySelector('.meta-card-img-wrap');
        if (imgSrc) {
            if (!wrap) {
                wrap = document.createElement('div');
                wrap.className = 'meta-card-img-wrap';
                wrap.style.position = 'relative';
                wrap.innerHTML = `<img class="meta-card-news-img" alt="Quest image"><button class="meta-card-img-chip">🔍 View</button>`;
                body.appendChild(wrap);
            }
            const imgEl = wrap.querySelector('.meta-card-news-img');
            imgEl.className = 'meta-card-news-img' + (q.type === 'WildHunt' ? ' meta-card-news-img--wildhunt' : '');
            imgEl.src = imgSrc;
            wrap.querySelector('.meta-card-img-chip').onclick = e => { e.stopPropagation(); openImgLightbox(imgSrc); };
        } else if (wrap) {
            wrap.remove();
        }
    }
    questIdDisplay.textContent      = `Quest ${_quest.quest_id ?? '???'}`;
    questVariantDisplay.textContent = `v${_quest.variant_index ?? 0}`;
    questTitleDisplay.textContent   = _quest.comment ?? '';
    persistQuest();
}

// ── Named param stats inline (compact table shown under the picker button) ──────
function buildNamedParamStatsInline(container, p) {
    if (!p || p.id === 0) { container.innerHTML = ''; container.style.display = 'none'; return; }
    container.style.display = '';
    const typeName = p.type.replace('NAMED_TYPE_', '');

    const statRow = (label, val) => {
        if (val == null || val === 100) return '';
        const cls = val > 100 ? 'np-high' : 'np-low';
        return `<span class="nsi-chip ${cls}" title="${label}">${label} ${val}%</span>`;
    };
    const chips = [
        statRow('HP',    p.hp),
        statRow('AtkP',  p.atkP),   statRow('AtkM',  p.atkM),
        statRow('DefP',  p.defP),   statRow('DefM',  p.defM),
        statRow('Exp',   p.exp),    statRow('Power', p.power),
    ].filter(Boolean).join('');

    container.innerHTML =
        `<div class="ep-named-type">${typeName} · #${p.id}</div>` +
        (chips ? `<div class="ep-named-chips">${chips}</div>` : '');
}

// ── Named param picker modal ──────────────────────────────────────────────────
function openNamedParamPicker(onSelect, currentId, baseEmName) {
    const modal   = document.getElementById('qb-named-param-modal');
    if (!modal) return;

    const searchEl   = modal.querySelector('#qb-np-search');
    const listEl     = modal.querySelector('#qb-np-list');
    const previewEl  = modal.querySelector('#qb-np-preview');
    const toggleBtn  = modal.querySelector('#qb-np-stat-toggle');

    // ── preview pane ──────────────────────────────────────────────────────────
    function renderPreview(p) {
        if (!p || p.id === 0) {
            previewEl.innerHTML = '<div class="np-preview-empty">Hover a param to preview</div>';
            return;
        }
        const typeName = p.type.replace('NAMED_TYPE_', '');
        const combinedHtml = namedParamCombinedHtml(p, baseEmName);
        const origNote = (p.type === 'NAMED_TYPE_REPLACE' && baseEmName)
            ? `<div style="font-size:10px;color:var(--text2);margin-top:1px">replaces: ${escHtml(baseEmName)}</div>` : '';
        const pct = v => v != null ? `${v}%` : '—';
        const row = (label, val) => {
            if (val == null) return '';
            const cls = val > 100 ? ' class="np-high"' : val < 100 ? ' class="np-low"' : '';
            return `<tr><td>${label}</td><td${cls}>${pct(val)}</td></tr>`;
        };
        const sec = (title, ...rows) => {
            const content = rows.join('');
            if (!content) return '';
            return `<tr class="np-stat-sec"><td colspan="2">${title}</td></tr>${content}`;
        };
        previewEl.innerHTML =
            `<div class="np-preview-combined">${combinedHtml}</div>` +
            origNote +
            `<div class="np-preview-type">${typeName} · ID ${p.id}` +
            (p.jp ? ` · <span style="font-size:10px;opacity:0.7">${escHtml(p.jp)}</span>` : '') +
            `</div>` +
            `<table class="np-stat-table">` +
            sec('HP',       row('HP Rate', p.hp), row('HP Sub', p.hpSub)) +
            sec('Attack',   row('Base Phys', p.atkP), row('Base Magic', p.atkM),
                            row('Wep Phys', p.atkWepP), row('Wep Magic', p.atkWepM)) +
            sec('Defence',  row('Base Phys', p.defP), row('Base Magic', p.defM),
                            row('Wep Phys', p.defWepP), row('Wep Magic', p.defWepM),
                            row('Guard Base', p.guardBase), row('Guard Wep', p.guardWep)) +
            sec('Other',    row('Ailment', p.ailment), row('Experience', p.exp), row('Power', p.power)) +
            sec('Endurance', row('Blow Main', p.blowMain), row('Blow Sub', p.blowSub),
                             row('Down Main', p.downMain), row('OCD', p.ocd),
                             row('Shake Main', p.shakeMain), row('Shrink Main', p.shrinkMain),
                             row('Shrink Sub', p.shrinkSub)) +
            `</table>`;
    }

    // ── list item HTML ────────────────────────────────────────────────────────
    function itemHtml(p, active) {
        const tag  = p.type === 'NAMED_TYPE_PREFIX'  ? 'Pfx'
                   : p.type === 'NAMED_TYPE_REPLACE'  ? 'Rep'
                   : p.type === 'NAMED_TYPE_SUFFIX'   ? 'Sfx'
                   : '';
        const displayHtml = namedParamCombinedHtml(p, baseEmName) || `<span style="color:var(--text2)">(stat-only)</span>`;
        return `<div class="np-item${active ? ' np-active' : ''}" data-id="${p.id}">` +
            `<span class="np-item-name">${displayHtml}</span>` +
            `<span class="np-item-meta">${tag ? `<span class="np-type-badge">${tag}</span> ` : ''}#${p.id}</span>` +
            `</div>`;
    }

    // ── list rendering ────────────────────────────────────────────────────────
    function renderList(query) {
        const q          = query.trim().toLowerCase();
        const showStat   = toggleBtn.classList.contains('active');
        const noneEntry  = { id: 0, name: '(None)', type: 'NAMED_TYPE_NONE' };

        const filtered = namedParamList.filter(p => {
            const hasName = !!p.name?.trim();
            if (!showStat && !hasName) return false;
            if (!q) return true;
            if (String(p.id).includes(q)) return true;
            if (p.name?.toLowerCase().includes(q)) return true;
            if (p.jp?.toLowerCase().includes(q)) return true;
            const combined = namedParamDisplayName(p, baseEmName);
            if (combined?.toLowerCase().includes(q)) return true;
            return false;
        }).slice(0, 200);

        const showNone = !q || '0'.includes(q) || 'none'.includes(q);
        const results  = showNone ? [noneEntry, ...filtered] : filtered;

        if (!results.length) { listEl.innerHTML = '<div class="np-empty">No results.</div>'; return; }

        if (!q && showStat) {
            // Divide into named vs stat-only sections
            const named    = filtered.filter(p =>  p.name?.trim());
            const statOnly = filtered.filter(p => !p.name?.trim());
            const divider  = (label, count) =>
                `<div class="np-section-divider">${label} <span class="np-section-count">${count}</span></div>`;
            listEl.innerHTML =
                itemHtml(noneEntry, currentId === 0) +
                divider('Named', named.length) +
                named.map(p => itemHtml(p, p.id === currentId)).join('') +
                (statOnly.length ? divider('Stat-only', statOnly.length) +
                    statOnly.map(p => itemHtml(p, p.id === currentId)).join('') : '');
        } else {
            listEl.innerHTML = results.map(p => itemHtml(p, p.id === currentId)).join('');
        }

        listEl.querySelectorAll('.np-item').forEach(el => {
            el.addEventListener('mouseenter', () => renderPreview(namedParamsById.get(parseInt(el.dataset.id))));
            el.addEventListener('click', () => {
                const id = parseInt(el.dataset.id);
                modal.classList.remove('open');
                onSelect(id);
            });
        });
    }

    // Re-init on each open (abort previous listeners)
    if (modal._abortCtrl) modal._abortCtrl.abort();
    modal._abortCtrl = new AbortController();
    const sig = modal._abortCtrl.signal;
    searchEl.addEventListener('input', () => renderList(searchEl.value), { signal: sig });
    toggleBtn.addEventListener('click', () => {
        const on = toggleBtn.classList.toggle('active');
        toggleBtn.textContent = on ? 'Stat-only: On' : 'Stat-only: Off';
        renderList(searchEl.value);
    }, { signal: sig });

    searchEl.value = '';
    toggleBtn.classList.remove('active');
    toggleBtn.textContent = 'Stat-only: Off';
    renderPreview(namedParamsById.get(currentId) ?? null);
    renderList('');
    modal.classList.add('open');
    setTimeout(() => searchEl.focus(), 50);
}

// ── Enemy advanced section (DOM, built after innerHTML so we can use resource lookups) ──
function buildEnemyAdvancedSection(en) {
    const details = document.createElement('details');
    details.className = 'ep-advanced';

    const summary = document.createElement('summary');
    summary.textContent = 'Advanced';
    details.appendChild(summary);

    // Grid container — same 2-col layout as cmd-params
    const grid = document.createElement('div');
    grid.className = 'cmd-params ep-advanced-body';
    details.appendChild(grid);

    const emKey = emNameKey(en.enemy_id);

    // Helper: full-width section divider
    const addSection = label => {
        const h = document.createElement('div');
        h.className = 'ep-adv-section';
        h.textContent = label;
        grid.appendChild(h);
    };
    // Helper: one grid cell (cmd-param)
    const cell = (label, ctrl, spanFull, title) => {
        const p = document.createElement('div');
        p.className = 'cmd-param';
        if (spanFull) p.style.gridColumn = '1/-1';
        const lbl = document.createElement('span');
        lbl.className = 'cmd-param-label';
        lbl.textContent = label;
        if (title) lbl.title = title;
        p.appendChild(lbl);
        if (Array.isArray(ctrl)) ctrl.forEach(c => p.appendChild(c));
        else p.appendChild(ctrl);
        grid.appendChild(p);
        return p;
    };
    const numInput = (field, value) => {
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.className = 'prop-input';
        inp.dataset.epNum = field;
        inp.value = value ?? '';
        inp.min = '0';
        return inp;
    };
    const selectInput = (field, options, curVal) => {
        const sel = document.createElement('select');
        sel.className = 'prop-select';
        sel.dataset.epNum = field;
        options.forEach(({value, label}) => {
            const opt = document.createElement('option');
            opt.value = value ?? '';
            opt.textContent = label;
            if ((value == null && curVal == null) || String(value) === String(curVal)) opt.selected = true;
            sel.appendChild(opt);
        });
        return sel;
    };
    const checkLabel = (field, checked, label, title) => {
        const lbl = document.createElement('label');
        lbl.className = 'ep-flag';
        if (title) lbl.title = title;
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.dataset.epBool = field;
        if (checked) cb.checked = true;
        lbl.appendChild(cb);
        lbl.appendChild(document.createTextNode(' ' + label));
        return lbl;
    };
    const flagCell = (label, ...flags) => {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:2px';
        flags.forEach(f => wrap.appendChild(f));
        cell(label, wrap, true);
    };

    // ── Appearance ────────────────────────────────────────────────────────────
    addSection('Appearance');

    cell('Variant', selectInput('infection_type', [
        {value: null, label: '0 — None'},
        {value: 1,    label: '1 — Infected'},
        {value: 2,    label: '2 — Severely Infected'},
        {value: 3,    label: '3 — War-Ready'},
    ], en.infection_type));

    // Montage Fix — select with known indices when available
    (() => {
        const mi    = emKey ? (emMontageInfo[emKey] ?? null) : null;
        const cur   = en.montage_fix_no ?? 0;
        const notes = (emKey && mi) ? (montageNotes[emKey] ?? {}) : {};
        let ctrl;
        if (mi && mi.length > 0) {
            const allVals = mi.includes(cur) ? mi : [...mi, cur];
            ctrl = selectInput('montage_fix_no',
                allVals.map(v => ({value: v, label: v + (notes[String(v)] ? ` — ${notes[String(v)]}` : '')})),
                cur);
            cell('Montage Fix', ctrl, false, `Valid indices from enemy .dme: ${mi.join(', ')}`);
        } else {
            ctrl = numInput('montage_fix_no', en.montage_fix_no);
            if (mi !== null) ctrl.title = 'No montage variants recorded for this enemy';
            cell('Montage Fix', ctrl);
        }
    })();

    cell('Scale %', numInput('scale', en.scale ?? 100));

    // ── Behaviour ─────────────────────────────────────────────────────────────
    addSection('Behaviour');

    // Hm Preset — read-only info derived from enemy type
    (() => {
        const ep  = emKey ? hmPresetsByEmCode.get(emKey) : null;
        const txt = ep ? `${ep.id}${ep.name ? ' — ' + ep.name : ''}` : '—';
        const span = document.createElement('span');
        span.textContent = txt;
        span.style.cssText = 'font-size:11px;color:var(--text2);align-self:center';
        cell('Hm Preset', span, false, 'Derived from enemy type — set automatically by server');
    })();

    // Think Table — select over observed range when known
    (() => {
        const ti    = emKey ? (emThinkInfo[emKey] ?? null) : null;
        const cur   = en.start_think_tbl_no ?? 0;
        const notes = ti ? (thinkTableNotes[ti.res] ?? {}) : {};
        if (ti) {
            const indices = Array.from({length: ti.max + 1}, (_, i) => i);
            if (!indices.includes(cur)) indices.push(cur);
            const ctrl = selectInput('start_think_tbl_no',
                indices.map(i => ({value: i, label: i + (notes[i] ? ` — ${notes[i]}` : '')})),
                cur);
            const resSpan = document.createElement('span');
            resSpan.textContent = ti.res;
            resSpan.style.cssText = 'font-size:9px;color:var(--text2);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
            resSpan.title = ti.res;
            const p = cell('Think Tbl', ctrl, false, `${ti.res} (range 0–${ti.max})`);
            p.appendChild(resSpan);
        } else {
            cell('Think Tbl', numInput('start_think_tbl_no', en.start_think_tbl_no));
        }
    })();

    cell('Set Type', selectInput('set_type', [
        {value: null, label: 'Auto'},
        {value: 0,    label: '0 — Normal'},
        {value: 1,    label: '1 — (Unknown)'},
        {value: 2,    label: '2 — Gather Spawn'},
        {value: 3,    label: '3 — Network Spawn'},
    ], en.set_type));

    flagCell('Manual Set',
        checkLabel('is_manual_set', en.is_manual_set, 'Manual Set',
            'Spawns dormant (mIsWaitting=true), activated by a SummonSet FSM action'));

    // ── Boss ──────────────────────────────────────────────────────────────────
    addSection('Boss');
    cell('Raid Boss ID', numInput('raid_boss_id', en.raid_boss_id));
    cell('Target Type', selectInput('enemy_target_types_id', [
        {value: null, label: 'Auto (from Required)'},
        {value: 1,    label: '1 — None'},
        {value: 2,    label: '2 — #2'},
        {value: 3,    label: '3 — #3'},
        {value: 4,    label: '4 — #4'},
        {value: 6,    label: '6 — Area Boss'},
        {value: 7,    label: '7 — Stage Boss'},
    ], en.enemy_target_types_id));
    flagCell('Boss Flags',
        checkLabel('is_boss_bgm',   en.is_boss_bgm,   'BGM'),
        checkLabel('is_boss_gauge', en.is_boss_gauge,  'Gauge'),
        checkLabel('is_area_boss',  en.is_area_boss,   'Area Boss'));

    // ── Repop ─────────────────────────────────────────────────────────────────
    addSection('Repop');
    cell('Wait (s)',  numInput('repop_wait_second', en.repop_wait_second ?? 0));
    cell('Num',       numInput('repop_num',   en.repop_num));
    cell('Count',     numInput('repop_count', en.repop_count));

    // ── Timing ────────────────────────────────────────────────────────────────
    addSection('Timing');
    (() => {
        const startInp = numInput('spawn_time_start', en.spawn_time_start);
        startInp.placeholder = 'ms';
        const endInp = numInput('spawn_time_end', en.spawn_time_end);
        endInp.placeholder = 'ms';
        cell('Spawn Start', startInp);
        cell('Spawn End',   endInp);
    })();

    return details;
}

// ── Enemy Group Prop Panel ────────────────────────────────────────────────────
function buildEnemyItemHtml(en, ei, isManual) {
    const base       = emName(en.enemy_id) || en.enemy_id || '';
    const np         = en.named_enemy_params_id ? namedParamsById.get(en.named_enemy_params_id) : null;
    const nameHtml   = namedParamCombinedHtml(np, base);
    const useAutoExp = en.exp_scheme === 'automatic' || en.exp_scheme === 'exm';
    return `<div class="cmd-item ep-enemy-item" data-ei="${ei}">
        <div class="cmd-item-header">
            <span class="ep-ei-badge">#${ei}</span>
            <span class="ep-em-label">${nameHtml}</span>
            <button class="cmd-delete-btn ep-del-enemy" data-del-ei="${ei}" title="Remove enemy">✕</button>
        </div>
        <div class="cmd-params">
            <div class="cmd-param" style="grid-column:1/-1">
                <span class="cmd-param-label">Enemy ID</span>
                <div class="ep-em-picker-mount" data-val="${escAttr(en.enemy_id ?? '')}" style="flex:1"></div>
            </div>
            <div class="ep-named-param-mount" style="grid-column:1/-1"></div>
            <div class="cmd-param" style="grid-column:1/-1">
                <span class="cmd-param-label">Comment</span>
                <input type="text" class="prop-input" data-ep="comment" value="${escAttr(en.comment ?? '')}" placeholder="optional">
            </div>
            <div class="cmd-param">
                <span class="cmd-param-label">Level</span>
                <input type="number" class="prop-input" data-ep-num="level" value="${en.level ?? 1}" min="1" max="200" style="width:56px;flex:none">
            </div>
            <div class="cmd-param">
                <span class="cmd-param-label">PP (Play Points)</span>
                <input type="number" class="prop-input" data-ep-num="pp" value="${en.pp ?? ''}" min="0" placeholder="0" title="Post-cap experience for end-game progression">
            </div>
            <div class="cmd-param">
                <span class="cmd-param-label">Exp Scheme</span>
                <select class="prop-select" data-ep="exp_scheme" style="flex:1">
                    <option value="" ${!en.exp_scheme ? 'selected' : ''}>Manual (set EXP)</option>
                    <option value="automatic" ${en.exp_scheme === 'automatic' ? 'selected' : ''}>Automatic</option>
                    <option value="exm" ${en.exp_scheme === 'exm' ? 'selected' : ''}>EXM</option>
                </select>
            </div>
            <div class="cmd-param ep-exp-row" ${useAutoExp ? 'style="display:none"' : ''}>
                <span class="cmd-param-label">EXP</span>
                <input type="number" class="prop-input" data-ep-num="exp" value="${en.exp ?? 0}" min="0">
            </div>
            <div class="cmd-param">
                <span class="cmd-param-label">Blood Orbs</span>
                <input type="number" class="prop-input" data-ep-num="blood_orbs" value="${en.blood_orbs ?? ''}" min="0" placeholder="0">
            </div>
            <div class="cmd-param">
                <span class="cmd-param-label">High Orbs</span>
                <input type="number" class="prop-input" data-ep-num="high_orbs" value="${en.high_orbs ?? ''}" min="0" placeholder="0">
            </div>
            ${isManual ? `<div class="cmd-param">
                <span class="cmd-param-label">Index</span>
                <input type="number" class="prop-input" data-ep-num="index" value="${en.index ?? 0}" min="0" max="255" style="width:56px;flex:none">
            </div>` : ''}
            <div class="cmd-param" style="grid-column:1/-1">
                <span class="cmd-param-label">Flags</span>
                <div style="display:flex;flex-direction:row;align-items:center;gap:12px;margin-top:2px">
                    <label class="ep-flag"><input type="checkbox" data-ep-bool="is_boss" ${en.is_boss ? 'checked' : ''}> Boss</label>
                    <label class="ep-flag"><input type="checkbox" data-ep-bool="is_required" ${en.is_required !== false ? 'checked' : ''}> Required</label>
                </div>
            </div>
            <div class="ep-advanced-mount" style="grid-column:1/-1"></div>
        </div>
    </div>`;
}

function spawnNodeForEnemy(g, ei) {
    const isManual = (g.placement_type || '').toLowerCase() === 'manual';
    const posIdx = isManual
        ? (g.enemies?.[ei]?.index ?? null)
        : (g.starting_index ?? 0) + ei;
    if (posIdx == null) return null;
    return document.querySelector(`#eg-spider .eg-spawn-node[data-posidx="${posIdx}"]`);
}

// Wire the data-ep-num and data-ep-bool controls inside a (re)built advanced section.
// Called once on initial build and again whenever the advanced section is rebuilt
// (i.e. when the enemy ID changes and think/montage info must update).
function wireEnemyItemAdvanced(advEl, en) {
    advEl.querySelectorAll('[data-ep-num]').forEach(inp => {
        inp.addEventListener('change', () => {
            const field = inp.dataset.epNum;
            const val = inp.value !== '' ? parseInt(inp.value) : undefined;
            if (val == null || isNaN(val)) delete en[field];
            else en[field] = val;
            persistQuest();
        });
    });
    advEl.querySelectorAll('[data-ep-bool]').forEach(cb => {
        cb.addEventListener('change', () => {
            const field = cb.dataset.epBool;
            if (cb.checked) en[field] = true;
            else delete en[field];
            syncEgCard();
            persistQuest();
        });
    });
}

function mountNamedParamWidget(mountEl, en) {
    const curId    = en.named_enemy_params_id ?? 0;
    const curParam = curId ? namedParamsById.get(curId) : null;
    const baseEmName = () => emName(en.enemy_id) || null;

    const wrap = document.createElement('div');
    wrap.className = 'cmd-param';

    const lbl = document.createElement('span');
    lbl.className = 'cmd-param-label';
    lbl.textContent = 'Named Param';
    wrap.appendChild(lbl);

    const inner = document.createElement('div');
    inner.style.cssText = 'display:flex;flex-direction:column;gap:3px;flex:1';

    const btn = document.createElement('button');
    btn.className = 'ep-named-btn';
    btn.dataset.namedId = curId;
    btn.textContent = namedParamLabel(curParam ?? (curId ? {id: curId} : null));

    const statsDiv = document.createElement('div');
    statsDiv.className = 'ep-named-stats';
    buildNamedParamStatsInline(statsDiv, curParam);

    inner.appendChild(btn);
    inner.appendChild(statsDiv);
    wrap.appendChild(inner);
    mountEl.replaceWith(wrap);

    btn.addEventListener('click', () => {
        openNamedParamPicker(newId => {
            const p = namedParamsById.get(newId) ?? null;
            en.named_enemy_params_id = newId || undefined;
            btn.dataset.namedId = newId;
            btn.textContent = namedParamLabel(p ?? (newId ? {id: newId} : null));
            buildNamedParamStatsInline(statsDiv, p);
            const header = btn.closest('.ep-enemy-item')?.querySelector('.ep-em-label');
            if (header) header.innerHTML = namedParamCombinedHtml(p || null, emName(en.enemy_id) || en.enemy_id || '');
            syncEgCard();
            persistQuest();
        }, en.named_enemy_params_id ?? 0, baseEmName());
    });
}

function wireEnemyItem(item, g, gi) {
    const ei = parseInt(item.dataset.ei);
    const en = g.enemies?.[ei];
    if (!en) return;

    item.addEventListener('mouseenter', () => {
        item.classList.add('ep-item-hover');
        spawnNodeForEnemy(g, ei)?.classList.add('eg-spawn-panel-lit');
    });
    item.addEventListener('mouseleave', () => {
        item.classList.remove('ep-item-hover');
        spawnNodeForEnemy(g, ei)?.classList.remove('eg-spawn-panel-lit');
    });

    // Enemy picker (replaces raw hex input)
    const emMount = item.querySelector('.ep-em-picker-mount');
    if (emMount) {
        emMount.replaceWith(buildEmPicker(en.enemy_id, hexId => {
            en.enemy_id = hexId;
            const lbl = item.querySelector('.ep-em-label');
            const np2 = en.named_enemy_params_id ? namedParamsById.get(en.named_enemy_params_id) : null;
            if (lbl) lbl.innerHTML = namedParamCombinedHtml(np2, emName(hexId) || hexId || '');
            const npStats = item.querySelector('.ep-named-stats');
            if (npStats) buildNamedParamStatsInline(npStats, np2);
            // Rebuild advanced section so think/montage/hmpreset reflect new enemy
            const oldAdv = item.querySelector('.ep-advanced');
            if (oldAdv) {
                const newAdv = buildEnemyAdvancedSection(en);
                oldAdv.replaceWith(newAdv);
                wireEnemyItemAdvanced(newAdv, en);
            }
            syncEgCard();
            persistQuest();
        }));
    }

    const npMount = item.querySelector('.ep-named-param-mount');
    if (npMount) mountNamedParamWidget(npMount, en);

    item.querySelectorAll('[data-ep]').forEach(inp => {
        inp.addEventListener('change', () => {
            const field = inp.dataset.ep;
            if (field === 'exp_scheme') {
                if (inp.value) { en.exp_scheme = inp.value; delete en.exp; }
                else { delete en.exp_scheme; if (en.exp == null) en.exp = 0; }
                const expRow = item.querySelector('.ep-exp-row');
                if (expRow) expRow.style.display = (inp.value === 'automatic' || inp.value === 'exm') ? 'none' : '';
            } else if (field === 'comment') {
                en.comment = inp.value || undefined;
            }
            persistQuest();
        });
    });

    item.querySelectorAll('[data-ep-num]').forEach(inp => {
        inp.addEventListener('change', () => {
            const field = inp.dataset.epNum;
            const val = inp.value !== '' ? parseInt(inp.value) : undefined;
            if (val == null || isNaN(val)) delete en[field];
            else en[field] = val;
            persistQuest();
            if (field === 'index') openEnemyGroupSpider(gi);
        });
    });

    item.querySelectorAll('[data-ep-bool]').forEach(cb => {
        cb.addEventListener('change', () => {
            const field = cb.dataset.epBool;
            if (field === 'is_required') {
                if (cb.checked) delete en.is_required;
                else en.is_required = false;
            } else {
                if (cb.checked) en[field] = true;
                else delete en[field];
            }
            syncEgCard();
            persistQuest();
        });
    });

    item.querySelector('.ep-del-enemy')?.addEventListener('click', () => {
        g.enemies.splice(ei, 1);
        renderEgPropPanel(gi);
        syncEgCard();
        persistQuest();
        openEnemyGroupSpider(gi);
    });

    // Advanced section — mounted last so the querySelectorAll loops above don't
    // double-wire it; wireEnemyItemAdvanced handles its own listeners.
    const advMount = item.querySelector('.ep-advanced-mount');
    if (advMount) {
        const adv = buildEnemyAdvancedSection(en);
        advMount.replaceWith(adv);
        wireEnemyItemAdvanced(adv, en);
    }
}

function renderEgPropPanel(gi) {
    const q = _quest;
    const g = q.enemy_groups?.[gi];
    if (!g) { _selection = null; renderPropPanel(); return; }

    propHeaderSub.textContent = `Enemy Group #${gi}`;
    propDelete.style.display = '';

    const sid      = g.stage_id || {};
    const isManual = (g.placement_type || 'Automatic').toLowerCase() === 'manual';
    const enemies  = g.enemies || [];

    propBody.innerHTML = `
    <div class="prop-section">
        <div class="prop-section-title">Group #${gi}</div>
        <div class="prop-row">
            <label class="prop-label">Comment</label>
            <input type="text" class="prop-input" id="ep-comment" value="${escAttr(g.comment ?? '')}">
        </div>
        <div class="prop-row">
            <label class="prop-label">Stage</label>
            <span id="ep-stage-mount" data-val="${escAttr(String(sid.id ?? ''))}" style="flex:1"></span>
        </div>
        <div class="prop-row">
            <label class="prop-label">Group ID</label>
            <input type="number" class="prop-input" id="ep-group-id" value="${sid.group_id ?? 1}" min="0">
        </div>
        <div class="prop-row">
            <label class="prop-label">Placement</label>
            <select class="prop-select" id="ep-placement" style="flex:1">
                <option value="Automatic" ${!isManual ? 'selected' : ''}>Automatic</option>
                <option value="Manual"    ${isManual  ? 'selected' : ''}>Manual</option>
            </select>
        </div>
        <div class="prop-row" id="ep-start-row" ${isManual ? 'style="display:none"' : ''}>
            <label class="prop-label">Start Index</label>
            <input type="number" class="prop-input" id="ep-start-idx" value="${g.starting_index ?? 0}" min="0" style="width:60px;flex:none">
        </div>
        <div class="prop-row">
            <label class="prop-label">Subgroup ID</label>
            <input type="number" class="prop-input" id="ep-subgroup" value="${g.subgroup_id ?? 0}" min="0" style="width:60px;flex:none">
        </div>
    </div>
    <div class="prop-section">
        <div class="prop-section-title" style="display:flex;align-items:center">
            Enemies
            <button class="add-cmd-btn" id="ep-add-enemy" style="margin-left:auto;padding:1px 8px;font-size:10px">＋ Add</button>
        </div>
        <div id="ep-enemy-list">
            ${enemies.map((en, ei) => buildEnemyItemHtml(en, ei, isManual)).join('')}
            ${enemies.length === 0 ? '<div style="font-size:10px;color:var(--text2);padding:4px 0">No enemies — click ＋ Add</div>' : ''}
        </div>
    </div>`;

    // Stage picker mount
    const stageMnt = propBody.querySelector('#ep-stage-mount');
    if (stageMnt) {
        const currentId = stageMnt.dataset.val !== '' ? parseInt(stageMnt.dataset.val) : undefined;
        stageMnt.replaceWith(buildStagePicker(currentId, newId => {
            if (!g.stage_id) g.stage_id = {};
            g.stage_id.id = newId;
            syncEgCard(); persistQuest();
            openEnemyGroupSpider(gi);
        }));
    }

    const wire = (id, fn) => propBody.querySelector(id)?.addEventListener('change', fn);
    wire('#ep-comment',  e => { g.comment   = e.target.value || undefined; syncEgCard(); persistQuest(); });
    wire('#ep-group-id', e => { if (!g.stage_id) g.stage_id = {}; g.stage_id.group_id = parseInt(e.target.value) || 0; syncEgCard(); persistQuest(); openEnemyGroupSpider(gi); });
    wire('#ep-start-idx',e => { g.starting_index = parseInt(e.target.value) || 0; persistQuest(); openEnemyGroupSpider(gi); });
    wire('#ep-subgroup', e => { g.subgroup_id   = parseInt(e.target.value) || 0; persistQuest(); });
    wire('#ep-placement', e => {
        const prev = g.placement_type || 'Automatic';
        g.placement_type = e.target.value;
        if (e.target.value === 'Manual' && prev !== 'Manual') {
            // Seed each enemy's index from its auto position
            const base = g.starting_index ?? 0;
            (g.enemies || []).forEach((en, ei) => { en.index = base + ei; });
        } else if (e.target.value !== 'Manual') {
            // Clear manual indices when reverting to auto
            (g.enemies || []).forEach(en => { delete en.index; });
        }
        propBody.querySelector('#ep-start-row').style.display = e.target.value === 'Manual' ? 'none' : '';
        persistQuest();
        renderEgPropPanel(gi);
        openEnemyGroupSpider(gi);
    });

    propBody.querySelector('#ep-add-enemy')?.addEventListener('click', () => {
        if (!g.enemies) g.enemies = [];
        const newEn = { enemy_id: '0x010101', level: 1, exp: 0 };
        if (isManual) newEn.index = g.enemies.length;
        g.enemies.push(newEn);
        renderEgPropPanel(gi);
        syncEgCard(); persistQuest();
        openEnemyGroupSpider(gi);
    });

    propBody.querySelectorAll('.ep-enemy-item').forEach(item => wireEnemyItem(item, g, gi));
}

// ── Property panel ─────────────────────────────────────────────────────────────
function renderPropPanel() {
    if (!_selection || !_quest) {
        propBody.innerHTML = '<div id="prop-empty">Select a block to edit its properties.</div>';
        propHeaderSub.textContent = '';
        propDelete.style.display = 'none';
        return;
    }

    // ── Meta card selected
    if (_selection.meta) {
        renderMetaPropPanel();
        return;
    }

    // ── Enemy group selected
    if (_selection.enemyGroup != null) {
        renderEgPropPanel(_selection.enemyGroup);
        return;
    }

    const { proc: pi, block: bi } = _selection;
    const proc  = _quest.processes[pi];
    const block = proc?.blocks[bi];
    if (!block) { clearSelection(); return; }

    const info = blockTypeInfo(block.type);
    const cat  = BLOCK_CAT[info.cat] ?? BLOCK_CAT.meta;

    propHeaderSub.textContent = `P${pi} · #${bi}`;
    propDelete.style.display = '';

    let html = '';

    // ── Block actions (reorder / move / copy-paste)
    html += `<div class="prop-section">
        <div class="prop-section-title">Block Actions</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px">
            <button class="add-cmd-btn" id="pp-copy-block" title="Copy this block to clipboard">📋 Copy</button>
            ${_copiedBlock ? `<button class="add-cmd-btn" id="pp-paste-after" style="border-color:var(--accent);color:var(--accent)" title="Paste clipboard block after this one">📋 Paste After</button>` : ''}
        </div>
    </div>`;

    // ── Comment
    html += `<div class="prop-section">
        <div class="prop-section-title">Comment</div>
        <div class="prop-row">
            <input type="text" class="prop-input" id="pp-comment" value="${escAttr(block.comment ?? '')}" placeholder="Optional note (not sent to client)">
        </div>
    </div>`;

    // ── Block type selector
    html += `<div class="prop-section">
        <div class="prop-section-title">Block Type</div>
        <div class="prop-row">
            <select class="prop-select" id="pp-type" style="color:${cat.color};font-weight:600">
                ${ALL_BLOCK_TYPES.map(t => `<option value="${t}" ${t===block.type?'selected':''}>${t}</option>`).join('')}
            </select>
        </div>
    </div>`;

    // ── Announce type
    if (info.fields.includes('announce_type')) {
        html += `<div class="prop-section">
            <div class="prop-section-title">Announce</div>
            <div class="prop-row">
                <select class="prop-select" id="pp-announce">
                    <option value="">(none)</option>
                    ${ANNOUNCE_TYPES.map(a => `<option value="${a}" ${a===block.announce_type?'selected':''}>${a}</option>`).join('')}
                </select>
            </div>
        </div>`;
    }

    // ── Stage ID
    if (info.fields.includes('stage_id')) {
        const sid = block.stage_id || {};
        html += `<div class="prop-section">
            <div class="prop-section-title">Stage ID</div>
            <div id="pp-stage-picker-mount" data-val="${sid.id ?? ''}"></div>
            <div class="stageid-group" style="margin-top:6px">
                <div class="prop-col">
                    <input type="number" class="prop-input" id="pp-stage-group" value="${sid.group_id ?? ''}" placeholder="grp">
                    <span class="stageid-sub">group</span>
                </div>
                <div class="prop-col">
                    <input type="number" class="prop-input" id="pp-stage-layer" value="${sid.layer_no ?? 0}">
                    <span class="stageid-sub">layer</span>
                </div>
            </div>
        </div>`;
    }

    // ── NPC ID
    if (info.fields.includes('npc_id')) {
        html += `<div class="prop-section">
            <div class="prop-section-title">NPC</div>
            <div class="prop-row">
                <label class="prop-label">NPC</label>
                <span id="pp-npc-picker-mount" data-val="${escAttr(block.npc_id ?? '')}" style="flex:1"></span>
            </div>
        </div>`;
    }

    // ── Message ID
    if (info.fields.includes('message_id')) {
        html += `<div class="prop-section">
            <div class="prop-section-title">Message</div>
            <div class="prop-row"><label class="prop-label">Message ID</label>
                <span id="pp-msg-picker-mount" data-val="${block.message_id ?? ''}" style="flex:1;min-width:0"></span>
            </div>
        </div>`;
    }

    // ── Groups (toggle chips referencing enemy_groups by index)
    if (info.fields.includes('groups')) {
        const availGroups = _quest.enemy_groups || [];
        const selected    = new Set(block.groups || []);
        const chipsHtml   = availGroups.length > 0
            ? availGroups.map((g, gi) => {
                const sid    = g.stage_id || {};
                const stLbl  = sid.id != null ? `St.${sid.id}` : '?';
                const grpLbl = sid.group_id != null ? `/G${sid.group_id}` : '';
                const count  = (g.enemies || []).length;
                const isSel  = selected.has(gi);
                const title  = g.comment ? `#${gi}: ${g.comment}` : `#${gi}: ${stLbl}${grpLbl} · ${count} enemies`;
                return `<div class="eg-chip${isSel ? ' eg-chip-on' : ''}" data-gi="${gi}" title="${escAttr(title)}">
                    <span class="eg-chip-idx">#${gi}</span>
                    <span class="eg-chip-stage">${stLbl}${grpLbl}</span>
                    <span class="eg-chip-count">${count}em</span>
                </div>`;
            }).join('')
            : `<span style="font-size:10px;color:var(--text2)">No enemy groups defined</span>`;
        html += `<div class="prop-section">
            <div class="prop-section-title">Groups</div>
            <div class="eg-chips-wrap" id="pp-group-chips">${chipsHtml}</div>
        </div>`;
    }

    // ── Checkpoint (universal)
    html += `<div class="prop-check-row">
        <input type="checkbox" id="pp-checkpoint" ${block.checkpoint ? 'checked' : ''}>
        <label for="pp-checkpoint">Checkpoint</label>
    </div>`;

    // ── Reset group flag
    if (info.fields.includes('reset_group')) {
        html += `<div class="prop-check-row">
            <input type="checkbox" id="pp-reset-group" ${block.reset_group ? 'checked' : ''}>
            <label for="pp-reset-group">Reset group after kill</label>
        </div>`;
    }

    // ── Items list
    if (info.fields.includes('items')) {
        const items = block.items || [];
        html += `<div class="prop-section">
            <div class="prop-section-title">Items</div>
            <div class="items-list" id="pp-items-list">
                ${items.map((it, ii) => `
                    <div class="item-row" data-item="${ii}">
                        <input type="number" class="prop-input" style="width:80px" data-field="id" value="${it.id ?? ''}" placeholder="Item ID">
                        <span>×</span>
                        <input type="number" class="prop-input" style="width:60px" data-field="amount" value="${it.amount ?? 1}" placeholder="Qty">
                        <span style="flex:1;font-size:10px;color:var(--text2)">${itemName(it.id)}</span>
                        <button class="flag-delete-btn" data-del-item="${ii}" title="Remove">✕</button>
                    </div>`).join('')}
            </div>
            <div style="margin-top:5px">
                <button class="add-cmd-btn" id="pp-add-item">＋ Add Item</button>
            </div>
        </div>`;
    }

    // ── check_flags / set_flags
    if (info.fields.includes('check_flags') || info.fields.includes('set_flags')) {
        const checkFlags = block.check_flags || [];
        const setFlags   = block.set_flags   || [];
        html += `<div class="prop-section">
            <div class="prop-section-title">Quest Flags</div>
            <div class="prop-row">
                <label class="prop-label">Check flags</label>
                <input type="text" class="prop-input" id="pp-check-flags" value="${escAttr(checkFlags.join(', '))}" placeholder="1, 2, 3">
            </div>
            <div class="prop-row">
                <label class="prop-label">Set flags</label>
                <input type="text" class="prop-input" id="pp-set-flags" value="${escAttr(setFlags.join(', '))}" placeholder="6">
            </div>
        </div>`;
    }

    // ── Flags array (QstLayout / MyQst etc.)
    if (info.fields.includes('flags') || (block.flags && block.flags.length > 0)) {
        const flags = block.flags || [];
        html += `<div class="prop-section">
            <div class="prop-section-title">Flags</div>
            <div id="pp-flags-list">
                ${flags.map((f, fi) => buildFlagItemHtml(f, fi)).join('')}
            </div>
            <div class="add-cmd-row" style="margin-top:5px">
                <button class="add-cmd-btn" id="pp-add-flag">＋ Add Flag</button>
            </div>
        </div>`;
    }

    // ── check_commands — shown for all blocks (collapsed if empty)
    {
        const cmds = block.check_commands || [];
        html += `<div class="prop-section">
            <div class="prop-section-title" style="color:#7ab">Check Commands
                <span style="font-weight:400;font-size:9px;margin-left:6px">gate conditions (all must pass)</span>
            </div>
            <div id="pp-check-cmds" class="cmd-list">
                ${cmds.map((c, ci) => buildCmdItemHtml(c, ci, 'check')).join('')}
            </div>
            <div class="cmd-picker-mount" data-kind="check"></div>
        </div>`;
    }

    // ── result_commands — shown for all blocks
    {
        const cmds = block.result_commands || [];
        html += `<div class="prop-section">
            <div class="prop-section-title" style="color:#fa8">Result Commands
                <span style="font-weight:400;font-size:9px;margin-left:6px">executed on completion</span>
            </div>
            <div id="pp-result-cmds" class="cmd-list">
                ${cmds.map((c, ci) => buildCmdItemHtml(c, ci, 'result')).join('')}
            </div>
            <div class="cmd-picker-mount" data-kind="result"></div>
        </div>`;
    }

    // ── contents_release (block level) ────────────────────────────────────────
    {
        const crs = block.contents_release || [];
        html += `<div class="prop-section">
            <div class="prop-section-title" style="color:#8dc">Contents Release
                <span style="font-weight:400;font-size:9px;margin-left:6px">unlocked on block completion</span>
            </div>
            <div id="pp-cr-list">
                ${crs.map((cr, i) => buildCrItemHtml(cr, i)).join('')}
            </div>
            <button class="add-cmd-btn" id="pp-add-cr" style="margin-top:4px;width:100%">＋ Add Release</button>
        </div>`;
    }

    propBody.innerHTML = html;

    // ── Mount stage pickers (must run after innerHTML is set) ──────────────────
    const ppStageMnt = propBody.querySelector('#pp-stage-picker-mount');
    if (ppStageMnt) {
        const currentId = ppStageMnt.dataset.val !== '' ? parseInt(ppStageMnt.dataset.val) : undefined;
        ppStageMnt.replaceWith(buildStagePicker(currentId, newId => {
            if (!block.stage_id) block.stage_id = {};
            block.stage_id.id = newId;
            renderBlockNode(pi, bi);
            persistQuest();
        }));
    }
    // ── Mount NPC picker (block field)
    const ppNpcMnt = propBody.querySelector('#pp-npc-picker-mount');
    if (ppNpcMnt) {
        const currentId = ppNpcMnt.dataset.val || null;
        ppNpcMnt.replaceWith(buildNpcPicker(currentId, newId => {
            block.npc_id = newId || undefined;
            renderBlockNode(pi, bi);
            persistQuest();
        }));
    }

    propBody.querySelectorAll('.cmd-stage-picker-mount').forEach(mount => {
        const pk        = mount.dataset.pk;
        const currentId = mount.dataset.val !== '' ? parseInt(mount.dataset.val) : undefined;
        const cmdItem   = mount.closest('[data-cmd-kind]');
        const ci        = cmdItem ? parseInt(cmdItem.dataset.cmdIdx) : -1;
        const kind      = cmdItem?.dataset.cmdKind;
        mount.replaceWith(buildStagePicker(currentId, newId => {
            const arrayKey = kind === 'check' ? 'check_commands' : 'result_commands';
            if (block[arrayKey]?.[ci]) {
                block[arrayKey][ci][pk] = newId;
                persistQuest();
            }
        }));
    });

    // ── Mount NPC pickers (cmd params)
    propBody.querySelectorAll('.cmd-npc-picker-mount').forEach(mount => {
        const pk      = mount.dataset.pk;
        const currentId = mount.dataset.val || null;
        const cmdItem = mount.closest('[data-cmd-kind]');
        const ci      = cmdItem ? parseInt(cmdItem.dataset.cmdIdx) : -1;
        const kind    = cmdItem?.dataset.cmdKind;
        mount.replaceWith(buildNpcPicker(currentId, newId => {
            const arrayKey = kind === 'check' ? 'check_commands' : 'result_commands';
            if (block[arrayKey]?.[ci]) {
                block[arrayKey][ci][pk] = newId; // stored as string
                persistQuest();
            }
        }));
    });

    // ── Mount command pickers ─────────────────────────────────────────────────
    propBody.querySelectorAll('.cmd-picker-mount').forEach(mount => {
        const kind  = mount.dataset.kind;
        const types = kind === 'check' ? CHECK_CMD_TYPES : RESULT_CMD_TYPES;
        mount.replaceWith(buildCmdPicker(type => {
            const key = kind === 'check' ? 'check_commands' : 'result_commands';
            if (!block[key]) block[key] = [];
            block[key].push(makeCmdObj(type));
            renderPropPanel();
            renderBlockNode(pi, bi);
        }, types));
    });

    // ── Block-level Contents Release wiring ──────────────────────────────────
    const ppCrList = propBody.querySelector('#pp-cr-list');

    propBody.querySelector('#pp-add-cr')?.addEventListener('click', () => {
        if (!block.contents_release) block.contents_release = [];
        block.contents_release.push({ type: 'None' });
        renderPropPanel();
        persistQuest();
    });

    ppCrList?.querySelectorAll('[data-del-cr]').forEach(btn => {
        btn.addEventListener('click', () => {
            block.contents_release?.splice(parseInt(btn.dataset.delCr), 1);
            renderPropPanel();
            persistQuest();
        });
    });

    ppCrList?.querySelectorAll('[data-cr-type]').forEach(sel => {
        sel.addEventListener('change', () => {
            const i = parseInt(sel.dataset.crType);
            if (!block.contents_release?.[i]) return;
            block.contents_release[i].type = sel.value;
            persistQuest();
        });
    });

    ppCrList?.querySelectorAll('[data-cr-tutorial]').forEach(sel => {
        sel.addEventListener('change', () => {
            const i = parseInt(sel.dataset.crTutorial);
            if (!block.contents_release?.[i]) return;
            if (sel.value) block.contents_release[i].tutorial_id = sel.value;
            else delete block.contents_release[i].tutorial_id;
            persistQuest();
        });
    });

    // ── Event listeners for prop panel controls ──────────────────────────────

    // Block actions
    propBody.querySelector('#pp-copy-block')?.addEventListener('click', () => copyBlock(pi, bi));
    propBody.querySelector('#pp-paste-after')?.addEventListener('click', () => pasteBlock(pi, bi + 1));

    // Block comment
    propBody.querySelector('#pp-comment')?.addEventListener('change', e => {
        const v = e.target.value.trim();
        if (v) block.comment = v; else delete block.comment;
        renderBlockNode(pi, bi);
        persistQuest();
    });

    // Block type
    propBody.querySelector('#pp-type')?.addEventListener('change', e => {
        block.type = e.target.value;
        // Reset unknown fields for new type
        renderPropPanel();
        renderBlockNode(pi, bi);
    });

    // Announce type
    propBody.querySelector('#pp-announce')?.addEventListener('change', e => {
        block.announce_type = e.target.value || undefined;
    });

    // Stage id — id field is handled by the stage picker mounted above
    propBody.querySelector('#pp-stage-group')?.addEventListener('change', e => {
        if (!block.stage_id) block.stage_id = {};
        block.stage_id.group_id = e.target.value !== '' ? parseInt(e.target.value) : undefined;
    });
    propBody.querySelector('#pp-stage-layer')?.addEventListener('change', e => {
        if (!block.stage_id) block.stage_id = {};
        const v = parseInt(e.target.value);
        block.stage_id.layer_no = !isNaN(v) ? v : 0;
    });



    // Message id picker
    const msgPickerMount = propBody.querySelector('#pp-msg-picker-mount');
    if (msgPickerMount) {
        const currentSerial = msgPickerMount.dataset.val !== '' ? parseInt(msgPickerMount.dataset.val) : null;
        const filterNpcId   = block.npc_id != null ? Number(block.npc_id) : null;
        const picker = buildMsgPicker(currentSerial, serial => {
            block.message_id = serial ?? undefined;
            renderBlockNode(pi, bi);
        }, filterNpcId);
        msgPickerMount.replaceWith(picker);
    }

    // Groups — chip toggles
    propBody.querySelectorAll('#pp-group-chips .eg-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const gi = parseInt(chip.dataset.gi);
            if (!block.groups) block.groups = [];
            const idx = block.groups.indexOf(gi);
            if (idx === -1) block.groups.push(gi);
            else block.groups.splice(idx, 1);
            block.groups.sort((a, b) => a - b);
            chip.classList.toggle('eg-chip-on', block.groups.includes(gi));
            renderBlockNode(pi, bi);
            persistQuest();
        });
    });

    // Checkpoint
    propBody.querySelector('#pp-checkpoint')?.addEventListener('change', e => {
        if (e.target.checked) block.checkpoint = true;
        else delete block.checkpoint;
        renderBlockNode(pi, bi); persistQuest();
    });

    // Reset group
    propBody.querySelector('#pp-reset-group')?.addEventListener('change', e => {
        if (e.target.checked) block.reset_group = true;
        else delete block.reset_group;
        renderBlockNode(pi, bi); persistQuest();
    });

    // Items list
    propBody.querySelector('#pp-add-item')?.addEventListener('click', () => {
        if (!block.items) block.items = [];
        block.items.push({ id: 0, amount: 1 });
        renderPropPanel();
    });
    propBody.querySelectorAll('[data-del-item]').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.delItem);
            block.items.splice(idx, 1);
            renderPropPanel();
            renderBlockNode(pi, bi);
        });
    });
    propBody.querySelectorAll('.item-row input').forEach(inp => {
        inp.addEventListener('change', () => {
            const row = inp.closest('.item-row');
            const ii  = parseInt(row.dataset.item);
            const field = inp.dataset.field;
            if (!block.items) block.items = [];
            if (!block.items[ii]) block.items[ii] = {};
            block.items[ii][field] = parseInt(inp.value) || 0;
            renderBlockNode(pi, bi);
        });
    });

    // check_flags / set_flags
    propBody.querySelector('#pp-check-flags')?.addEventListener('change', e => {
        block.check_flags = e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    });
    propBody.querySelector('#pp-set-flags')?.addEventListener('change', e => {
        block.set_flags = e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    });

    // Flags list
    propBody.querySelector('#pp-add-flag')?.addEventListener('click', () => {
        if (!block.flags) block.flags = [];
        block.flags.push({ type: 'QstLayout', action: 'Set', value: 0 });
        renderPropPanel();
    });
    propBody.querySelectorAll('[data-del-flag]').forEach(btn => {
        btn.addEventListener('click', () => {
            const fi = parseInt(btn.dataset.delFlag);
            block.flags.splice(fi, 1);
            renderPropPanel();
        });
    });
    propBody.querySelectorAll('.flag-item select, .flag-item input').forEach(inp => {
        inp.addEventListener('change', () => {
            const fi   = parseInt(inp.closest('.flag-item').dataset.flag);
            const field = inp.dataset.field;
            if (!block.flags[fi]) return;
            const intFields = new Set(['value', 'quest_id']);
            block.flags[fi][field] = intFields.has(field) ? (parseInt(inp.value) || 0) : inp.value;
            if (field === 'type') renderPropPanel(); // show/hide quest_id field
        });
    });

    // Check commands
    propBody.querySelectorAll('[data-del-check-cmd]').forEach(btn => {
        btn.addEventListener('click', () => {
            block.check_commands.splice(parseInt(btn.dataset.delCheckCmd), 1);
            renderPropPanel();
            renderBlockNode(pi, bi);
        });
    });
    propBody.querySelectorAll('[data-cmd-kind="check"]').forEach(item => {
        wireCmdItem(item, block, 'check_commands');
    });

    // Result commands
    propBody.querySelectorAll('[data-del-result-cmd]').forEach(btn => {
        btn.addEventListener('click', () => {
            block.result_commands.splice(parseInt(btn.dataset.delResultCmd), 1);
            renderPropPanel();
            renderBlockNode(pi, bi);
        });
    });
    propBody.querySelectorAll('[data-cmd-kind="result"]').forEach(item => {
        wireCmdItem(item, block, 'result_commands');
    });
}

function buildFlagItemHtml(f, fi) {
    const needsQuestId = f.type === 'WorldManageLayout' || f.type === 'WorldManageQuest';
    return `<div class="flag-item" data-flag="${fi}">
        <select data-field="type">
            ${FLAG_TYPES.map(t => `<option value="${t}" ${t===f.type?'selected':''}>${t}</option>`).join('')}
        </select>
        <select data-field="action">
            ${FLAG_ACTIONS.map(a => `<option value="${a}" ${a===f.action?'selected':''}>${a}</option>`).join('')}
        </select>
        <input type="number" data-field="value" value="${f.value ?? 0}" style="width:70px">
        ${needsQuestId ? `<input type="number" data-field="quest_id" value="${f.quest_id ?? ''}" placeholder="Quest ID" style="width:80px" title="Quest ID">` : ''}
        ${f.comment != null ? `<input type="text" data-field="comment" value="${escAttr(f.comment)}" placeholder="comment" style="flex:1;min-width:60px">` : ''}
        <button class="flag-delete-btn" data-del-flag="${fi}" title="Remove">✕</button>
    </div>`;
}

// Build a new command object with zeroed params
function makeCmdObj(type) {
    const params = getCmdParams(type);
    const obj = { type };
    ['Param1','Param2','Param3','Param4'].forEach((pk, i) => {
        if (i < params.length) {
            obj[pk] = NPC_PARAM_NAMES.has(params[i]?.name) ? '' : 0;
        }
    });
    return obj;
}

// Build HTML for a check or result command item in the prop panel
function buildCmdItemHtml(cmd, ci, kind) {
    const params  = getCmdParams(cmd.type);
    const delAttr = kind === 'check' ? `data-del-check-cmd="${ci}"` : `data-del-result-cmd="${ci}"`;
    const kindAttr = `data-cmd-kind="${kind}" data-cmd-idx="${ci}"`;

    const paramHtml = ['Param1','Param2','Param3','Param4'].map((pk, i) => {
        if (i >= Math.max(params.length, 1)) return ''; // always show at least Param1 for unknown
        const label   = params[i]?.name ?? pk;
        const val     = cmd[pk] ?? 0;
        const isStageParam = label === 'StageNo' || label === 'JumpStageNo';
        const isNpcParam   = NPC_PARAM_NAMES.has(label);
        const isMsgParam   = MSG_PARAM_NAMES.has(label);
        const mssEntry     = isMsgParam && _mssGroupMap ? _mssGroupMap.get(val) : null;
        const chipHtml     = isMsgParam
            ? (mssEntry
                ? `<button class="msg-preview-chip" data-serial="${val}" title="${escAttr(mssEntry.npcName)}">💬 ${escHtml(mssEntry.npcName)}</button>`
                : `<button class="msg-preview-chip msg-preview-chip--dim" data-serial="${val}" title="Load source files to preview">💬 #${val}</button>`)
            : '';
        return `<div class="cmd-param">
            <span class="cmd-param-label">${escHtml(label)}</span>
            ${isStageParam
                ? `<span class="cmd-stage-picker-mount" data-pk="${pk}" data-val="${val}"></span>`
                : isNpcParam
                    ? `<span class="cmd-npc-picker-mount" data-pk="${pk}" data-val="${escAttr(String(val))}"></span>`
                    : `<input type="number" data-pk="${pk}" value="${val}">`}
            ${chipHtml}
        </div>`;
    }).join('');

    return `<div class="cmd-item" ${kindAttr}>
        <div class="cmd-item-header">
            <select class="cmd-type-select" style="flex:1;background:var(--bg);border:1px solid var(--border2);border-radius:3px;color:var(--text);padding:2px 4px;font-size:11px;">
                ${ALL_CMD_TYPES.map(t => `<option value="${t}" ${t===cmd.type?'selected':''}>${t}</option>`).join('')}
            </select>
            <button class="cmd-delete-btn" ${delAttr} title="Remove">✕</button>
        </div>
        <div class="cmd-params">${paramHtml}</div>
    </div>`;
}

// Wire up event listeners for a cmd-item element
function wireCmdItem(item, block, arrayKey) {
    const ci = parseInt(item.dataset.cmdIdx);
    const cmd = block[arrayKey]?.[ci];
    if (!cmd) return;

    // Type change — rebuild params
    item.querySelector('.cmd-type-select')?.addEventListener('change', e => {
        cmd.type = e.target.value;
        // Zero out old params, add new ones
        const params = getCmdParams(cmd.type);
        ['Param1','Param2','Param3','Param4'].forEach((pk, i) => {
            if (i < params.length) { if (cmd[pk] == null) cmd[pk] = 0; }
            else delete cmd[pk];
        });
        renderPropPanel();
    });

    // Param inputs
    item.querySelectorAll('input[data-pk]').forEach(inp => {
        inp.addEventListener('change', () => {
            cmd[inp.dataset.pk] = parseInt(inp.value) || 0;
            // Refresh the msg preview chip if this param is a message reference
            renderPropPanel();
        });
    });

    // Message preview chips
    item.querySelectorAll('.msg-preview-chip').forEach(chip => {
        chip.addEventListener('click', e => {
            e.stopPropagation();
            showMsgPreview(chip, parseInt(chip.dataset.serial));
        });
    });
}

// ── MSS message preview popover ───────────────────────────────────────────────
let _msgPreviewEl = null;

function openImgLightbox(src) {
    document.querySelector('.img-lightbox')?.remove();
    const lb = document.createElement('div');
    lb.className = 'img-lightbox';
    lb.innerHTML = `
        <div class="img-lightbox-backdrop"></div>
        <div class="img-lightbox-frame">
            <button class="img-lightbox-close" title="Close">✕</button>
            <img class="img-lightbox-img" src="${escAttr(src)}" alt="Full image">
        </div>`;
    lb.querySelector('.img-lightbox-backdrop').addEventListener('click', () => lb.remove());
    lb.querySelector('.img-lightbox-close').addEventListener('click', () => lb.remove());
    lb.addEventListener('keydown', e => { if (e.key === 'Escape') lb.remove(); });
    document.body.appendChild(lb);
    lb.setAttribute('tabindex', '-1');
    lb.focus();
}

function syncOrderChip(card) {
    const c = (card ?? world.querySelector('.meta-card'))?.querySelector('.qtd-order-chip');
    if (!c) return;
    const entry = getQtdOrderEntry();
    c.classList.toggle('msg-preview-chip--dim', !entry);
    c.title = entry ? 'View order text' : 'Load source files to preview order text';
}

let _orderPopEl = null;

function closeOrderPop() {
    _orderPopEl?.remove();
    _orderPopEl = null;
}

function showOrderTextPop(anchor) {
    closeOrderPop();
    const entry = getQtdOrderEntry();
    const pop = document.createElement('div');
    pop.className = 'msg-preview-pop';

    if (!entry) {
        pop.innerHTML = `
            <div class="msg-preview-hdr">
                <span class="msg-preview-npc">📋 Order Text</span>
                <button class="msg-preview-close">✕</button>
            </div>
            <div class="msg-preview-body"><span style="color:var(--text2);font-style:italic">Load source files to see order text.</span></div>`;
    } else {
        pop.innerHTML = `
            <div class="msg-preview-hdr">
                <span class="msg-preview-npc">📋 Order Text</span>
                <button class="msg-preview-close">✕</button>
            </div>
            <div class="msg-preview-body">
                <div class="msg-preview-line">
                    ${entry.en ? `<span class="msg-preview-en">${escHtml(entry.en)}</span>` : ''}
                    ${entry.jp ? `<span class="msg-preview-jp">${escHtml(entry.jp)}</span>` : ''}
                </div>
            </div>`;
    }

    pop.querySelector('.msg-preview-close').addEventListener('click', closeOrderPop);
    document.body.appendChild(pop);
    _orderPopEl = pop;

    const rect = anchor.getBoundingClientRect();
    const popW = 320;
    let left = rect.left;
    if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
    pop.style.left = `${Math.max(8, left)}px`;
    pop.style.top  = `${rect.bottom + 4}px`;
}

function closeMsgPreview() {
    _msgPreviewEl?.remove();
    _msgPreviewEl = null;
}

function showMsgPreview(anchor, serial) {
    closeMsgPreview();
    const entry = _mssGroupMap?.get(serial);

    const pop = document.createElement('div');
    pop.className = 'msg-preview-pop';

    if (!entry) {
        pop.innerHTML = `
            <div class="msg-preview-hdr">
                <span class="msg-preview-npc">💬 serial:${serial}</span>
                <button class="msg-preview-close">✕</button>
            </div>
            <div class="msg-preview-body"><span style="color:var(--text2);font-style:italic">${_mssGroupMap ? 'No MSS entry found for this serial.' : 'Load source files to see message text.'}</span></div>`;
        pop.querySelector('.msg-preview-close').addEventListener('click', closeMsgPreview);
        document.body.appendChild(pop);
        _msgPreviewEl = pop;
        const rect = anchor.getBoundingClientRect();
        const popW = 280;
        let left = rect.left;
        if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
        pop.style.left = `${Math.max(8, left)}px`;
        pop.style.top  = `${rect.bottom + 4}px`;
        return;
    }

    const msgsHtml = entry.msgs.map(m =>
        `<div class="msg-preview-line">
            ${m.en ? `<span class="msg-preview-en">${escHtml(m.en)}</span>` : ''}
            ${m.jp ? `<span class="msg-preview-jp">${escHtml(m.jp)}</span>` : ''}
        </div>`
    ).join('');

    pop.innerHTML = `
        <div class="msg-preview-hdr">
            <span class="msg-preview-npc">🧑 ${escHtml(entry.npcName)}${entry.npcId != null ? ` <span class="msg-preview-npcid">#${entry.npcId}</span>` : ''}</span>
            <span class="msg-preview-serial">serial:${serial}</span>
            <button class="msg-preview-close">✕</button>
        </div>
        <div class="msg-preview-body">${msgsHtml || '<span style="color:var(--text2);font-style:italic">No messages</span>'}</div>`;

    pop.querySelector('.msg-preview-close').addEventListener('click', closeMsgPreview);
    document.body.appendChild(pop);
    _msgPreviewEl = pop;

    // Position below the chip, clamped to viewport
    const rect = anchor.getBoundingClientRect();
    const popW = 320;
    let left = rect.left;
    if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
    pop.style.left = `${Math.max(8, left)}px`;
    pop.style.top  = `${rect.bottom + 4}px`;
}

document.addEventListener('click', e => {
    if (_msgPreviewEl && !_msgPreviewEl.contains(e.target) && !e.target.closest('.msg-preview-chip')) {
        closeMsgPreview();
    }
    if (_orderPopEl && !_orderPopEl.contains(e.target) && !e.target.closest('.qtd-order-chip')) {
        closeOrderPop();
    }
});

// Re-render just one block node (lighter than full render)
function renderBlockNode(pi, bi) {
    const el = world.querySelector(`.block-node[data-proc="${pi}"][data-block="${bi}"]`);
    if (!el) return;
    const block = _quest?.processes?.[pi]?.blocks?.[bi];
    if (!block) return;
    const newNode = buildBlockNode(block, pi, bi);
    el.replaceWith(newNode);
    persistQuest();
}

// ── Block CRUD ────────────────────────────────────────────────────────────────
function insertBlock(pi, at) {
    if (!_quest) return;
    const proc = _quest.processes[pi];
    if (!proc) return;
    proc.blocks.splice(at, 0, normalizeBlock({ type: 'Raw', check_commands: [], result_commands: [] }));
    _selection = { proc: pi, block: at };
    render();
    renderPropPanel();
}

function deleteSelectedBlock() {
    if (!_selection || !_quest) return;
    if (_selection.enemyGroup != null) {
        _quest.enemy_groups?.splice(_selection.enemyGroup, 1);
        _selection = null;
        syncEgCard();
        renderPropPanel();
        persistQuest();
        return;
    }
    const { proc: pi, block: bi } = _selection;
    const proc = _quest.processes[pi];
    if (!proc) return;
    proc.blocks.splice(bi, 1);
    _selection = null;
    render();
    renderPropPanel();
}

function addProcess() {
    if (!_quest) return;
    const idx = _quest.processes.length;
    _quest.processes.push({ comment: `process ${idx}`, blocks: [] });
    render();
}

// ── Quest Meta modal ──────────────────────────────────────────────────────────
function openMeta() {
    if (!_quest) return;
    const q = _quest;
    document.getElementById('m-quest-id').value      = q.quest_id ?? '';
    document.getElementById('m-variant-index').value = q.variant_index ?? 0;
    document.getElementById('m-type').value           = q.type ?? 'World';
    document.getElementById('m-comment').value     = q.comment ?? '';
    document.getElementById('m-base-level').value  = q.base_level ?? '';
    document.getElementById('m-area-id').value     = q.area_id ?? 'HidellPlains';
    document.getElementById('m-news-image').value  = q.news_image ?? '';
    document.getElementById('m-min-item-rank').value = q.minimum_item_rank ?? '';
    document.getElementById('m-next-quest').value  = q.next_quest ?? '';
    document.getElementById('m-enabled').checked   = q.enabled ?? true;
    document.getElementById('m-discoverable').checked = q.discoverable ?? true;
    document.getElementById('m-important').checked = q.is_important ?? false;
    document.getElementById('m-enable-cancel').checked = q.enable_cancel ?? defaultEnableCancel(q.type);
    document.getElementById('m-override-enemy-spawn').checked = q.override_enemy_spawn ?? false;
    document.getElementById('m-reset-player').checked = q.reset_player_after_quest ?? false;
    document.getElementById('meta-modal').classList.add('open');
}

function closeMeta() {
    document.getElementById('meta-modal').classList.remove('open');
}

function applyMeta() {
    if (!_quest) return;
    const q = _quest;
    const numOrUndef = id => {
        const v = document.getElementById(id).value;
        return v !== '' ? parseInt(v) : undefined;
    };
    q.quest_id       = numOrUndef('m-quest-id');
    q.variant_index  = numOrUndef('m-variant-index') ?? 0;
    q.type           = document.getElementById('m-type').value;
    q.comment        = document.getElementById('m-comment').value || undefined;
    q.base_level     = numOrUndef('m-base-level');
    q.area_id        = document.getElementById('m-area-id').value;
    q.news_image     = numOrUndef('m-news-image');
    q.minimum_item_rank = numOrUndef('m-min-item-rank') ?? 0;
    const nq = numOrUndef('m-next-quest');
    if (nq != null) q.next_quest = nq; else delete q.next_quest;
    q.enabled          = document.getElementById('m-enabled').checked;
    q.discoverable     = document.getElementById('m-discoverable').checked;
    q.is_important     = document.getElementById('m-important').checked || undefined;
    q.enable_cancel    = document.getElementById('m-enable-cancel').checked || undefined;
    q.override_enemy_spawn = document.getElementById('m-override-enemy-spawn').checked || undefined;
    q.reset_player_after_quest = document.getElementById('m-reset-player').checked || undefined;
    // Clean up undefined
    Object.keys(q).forEach(k => { if (q[k] === undefined) delete q[k]; });
    closeMeta();
    enableQuestUI();
    persistQuest();
}

// ── Utility ───────────────────────────────────────────────────────────────────
// Split a PascalCase / camelCase enum name into readable words
function splitEnum(s) {
    return String(s)
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

function escHtml(s) {
    return String(s)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;');
}
function escAttr(s) {
    return String(s)
        .replace(/&/g,'&amp;')
        .replace(/"/g,'&quot;');
}

// ── Kick off ──────────────────────────────────────────────────────────────────
init();
