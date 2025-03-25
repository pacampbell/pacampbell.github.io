import argparse
import json
import re
import shutil

from pathlib import Path
from jinja2 import Environment, FileSystemLoader
from urllib.parse import urlparse

npc_ids = {}
stage_nos = {}
spot_ids = {}

category_map = {
    'main_quest': 'Main Quests',
    # 'pawn_quest': 'Pawn Quests',
    'personal_quest': 'Personal Quests',
    'world_quest': 'World Quests'
}

# <STG 201>
# <SPOT xxx>

def _genric_replace(match, type_map, not_found_name):
    type_id = int(match.group(1))
    if type_id in type_map:
        return f"{type_map[type_id]}"
    return f"&lt;{not_found_name} {type_id}&gt;"

def _replace_npc_id(match):
    return _genric_replace(match, npc_ids, 'NPC')

def _replace_stage_id(match):
    return _genric_replace(match, stage_nos, 'STG')

def _replace_spot_id(match):
    return _genric_replace(match, spot_ids, 'SPOT')

def _breakup_camelcase_string(string):
    if ' ' in string:
        return string
    res = re.findall('[A-Z][^A-Z]*', string)
    return ' '.join(filter(None, res))

def _get_quest_link(quest_map, quest_id):
    quest_name = f'q{quest_id:08d}'
    if quest_id in quest_map:
        quest_name = quest_map[quest_id]['name']
    return (f'q{quest_id:08d}', quest_name)

def _generate_quest_references(quest_data):
    if 'references' not in quest_data:
        return []

    references = []
    for reference in quest_data['references']:
        a = urlparse(reference)
        hostname = a.hostname
        if 'youtube' in hostname:
            hostname = 'yt'
        references.append((reference, hostname))
    return references

def _get_quest_unlocks(unlocks):
    if unlocks is None or len(unlocks) == 0:
        return []
    
    results = []
    for unlock in unlocks:
        results.append(_breakup_camelcase_string(unlock))

    return results

def _get_quest_name_from_condition(quest_map, condition):
    param01 = condition['param01']
    if param01 in quest_map:
        param01 = quest_map[param01]['name']
    return param01

def _get_quest_link_from_condition(args, quest_map, condition):
    quest_id = condition['param01']
    quest_name = _get_quest_name_from_condition(quest_map, condition)
    return f'<a href="q{quest_id:08d}.html">{quest_name}</a>'

def _get_condition(args, quest_map, quest, condition):
    condition_type = condition['type']
    if condition_type == 'MinimumLevel':
        param01 = condition['param01']
        return f"Minimum level of <tt><b>{param01}</b></tt> or higher in any vocation"
    elif condition_type == 'ClearPersonalQuest':
        param01 = _get_quest_link_from_condition(args, quest_map, condition)
        return f'Clear the personal quest <b>{param01}</b>'
    elif condition_type == 'MainQuestCompleted':
        param01 = _get_quest_link_from_condition(args, quest_map, condition)
        return f'Clear the main story quest <b>{param01}</b>'
    elif condition_type == 'ClearExtremeMission':
        param01 = _get_quest_link_from_condition(args, quest_map, condition)
        return f'Clear the extreme mission <b>{param01}</b>'
    elif condition_type == 'ArisenTactics':
        return 'Complete the Arisen\'s Tactics Trial for Shield Sage, Hunter, Priest or Fighter'
    elif condition_type == 'AreaRank':
        param01 = _breakup_camelcase_string(condition['param01'])
        param02 = condition['param02']
        return f'Area rank of <tt><b>{param02}</b></tt> or higher in <tt><b>{param01}</b></tt>'
    elif condition_type == 'ItemRank':
        param01 = condition['param01']
        return f'Minimum item level of <tt><b>{param01}</b></tt> is required'
    elif condition_type == 'Message':
        return condition['param01']
    elif condition_type == 'MinimumVocationLevel':
        jobId = _breakup_camelcase_string(condition['param01'])
        level = condition['param02']
        return f'Vocation restriction: <tt><b>{jobId}</b></tt>, at least level <tt><b>{level}</b></tt>'

    return _breakup_camelcase_string(condition_type) 

def _get_quest_order_conditions(args, quest_map, quest_data):
    conditions = []
    for condition in quest_data['order_conditions']:
        conditions.append(_get_condition(args, quest_map, quest_data, condition))
    return conditions

def _get_quest_starting_npc(quest_data):
    npc_info = quest_data['starting_npc']
    if npc_info is not None:
        npc_info = f"{quest_data['starting_npc']['name']} ({quest_data['starting_npc']['stage']['name']})"
    else:
        npc_info = 'None'
    return npc_info

def _get_quest_subcategory(subcategory, quest_data):
    quest_type = quest_data['type']
    if quest_type == 'World':
        return _breakup_camelcase_string(quest_data['area_id'])
    elif quest_type == 'Main':
        return subcategory.replace('_', ' ', 1).replace('_', '.').title()
    return quest_type

def _get_quest_chain(quest_map, quest_data, key):
    quest = None
    if quest_data["quest_chain"][key] != 0:
        quest = _get_quest_link(quest_map, quest_data["quest_chain"][key])
    return quest

def _generate_reward_entries(unlocks, rewards):
    content = ''

    for slot in rewards:
        if 'type' not in slot:
            reward_type = 'Unlocks'
        else:
            reward_type = slot["type"]
        if reward_type == 'Select1':
            reward_type = 'Select one of the following'
        elif reward_type == 'Fixed':
            reward_type = 'Fixed Rewards'
        
        if len(content):
            content = f'{content}<br>・{reward_type}\n'
        else:
            content = f'・{reward_type}\n'

        pools = slot['pools']
        for i in range(0, len(pools)):
            item_list = ''
            for item in pools[i]:
                result = f'{item["name"]} x{item["amount"]}'

                if 'Bloodorb' in result:
                    result = f'<span class="reward-bloodorb">{result}</span>'

                if len(item_list) == 0:
                    item_list = result
                else:
                    item_list = f'{item_list}, {result}'

            if len(pools) == 1 or (len(pools) - 1) == i:
                item_list = f'└{item_list}'
            else:
                item_list = f'├{item_list}'
            content = f'{content}<br>{item_list}'

    if len(unlocks):
        unlock_string = ''
        for unlock in unlocks:
            unlock = _breakup_camelcase_string(unlock)
            unlock = f'<span class="reward-unlock">《{unlock}》</span>'
            if len(unlock_string):
                unlock_string = f'{unlock_string}, {unlock}'
            else:
                unlock_string = unlock
    
        if len(content):
            content = f'{content}<br><br>{unlock_string}'
        else:
            content = unlock_string

    return content

def _get_quest_variations(quest_data):
    variants = []

    keys = ['level', 'xp', 'gold', 'rift', 'ap', 'rewards']
    for variant in quest_data['variants']:
        result = []
        for key in keys:
            value = variant[key]

            width = 5
            alignment = 'center'

            if key == 'rewards':
                width = 75
                alignment = 'left'
                value = _generate_reward_entries([], value)
                if len(value) == 0:
                    value = 'None'
            elif key == 'level' and variant['is_bounty']:
                value = f'{value}<br>(bounty)'
            
            style = f'width: {width}%; text-align: {alignment};'
            result.append((value, style))
        variants.append(result)
    return variants

def _translate_string(string):
    if '<NPC' in string:
        string = re.sub(r'<NPC (\d+)>', _replace_npc_id, string)

    if '<STG' in string:
        string = re.sub(r'<STG (\d+)>', _replace_stage_id, string)

    if '<SPOT' in string:
        string = re.sub(r'<SPOT (\d+)>', _replace_spot_id, string)

    return ' '.join(string.split())

def build_quest_info(args, titles_map, info_template, quest_map, quest_data):
    quest_id = quest_data['quest_id']
    
    area_rank = None
    if quest_data['minimum_area_rank'] > 0:
        area_rank = f"{_breakup_camelcase_string(quest_data['area_id'])} {quest_data['minimum_area_rank']}"

    quest_walkthrough = None
    if 'walkthrough' in quest_data:
        quest_walkthrough = quest_data['walkthrough']

    translated_description = _translate_string(quest_data['description'])
    
    translated_steps = []
    for step in quest_data['steps']:
        translated_steps.append(_translate_string(step))

    content = info_template.render(
        quest_title_category=quest_data['title_category'],
        quest_title_subcategory =_get_quest_subcategory(quest_data['title_subcategory'], quest_data),
        quest_name=quest_data['name'],
        quest_id=quest_data['quest_id'],
        quest_jp_name=titles_map[quest_id]['jp_name'],
        quest_type=quest_data['type'],
        quest_style=quest_data['type'].lower(),
        quest_starting_npc=_get_quest_starting_npc(quest_data),
        quest_category=_breakup_camelcase_string(quest_data['guide_type']),
        quest_is_repeatable="Yes" if quest_data['repeatable'] else "No",
        quest_minimum_area_rank = area_rank,
        quest_description=translated_description,
        quest_references=_generate_quest_references(quest_data),
        quest_order_conditions=_get_quest_order_conditions(args, quest_map, quest_data),
        quest_tutorial_unlocks = _get_quest_unlocks(quest_data['unlocks']['tutorials']),
        quest_content_unlocks = _get_quest_unlocks(quest_data['unlocks']['contents']),
        next_quest = _get_quest_chain(quest_map, quest_data, 'next_quest_id'),
        prev_quest = _get_quest_chain(quest_map, quest_data, 'previous_quest_id'),
        quest_variations = _get_quest_variations(quest_data),
        quest_steps = translated_steps,
        quest_walkthrough = quest_walkthrough
    )

    output_file = Path(f'{args.output_dir}/q{quest_id:08d}.html')
    with open(output_file, mode='w', encoding='utf-8') as f:
        f.write(content)
        print(f"... wrote {output_file}")

def _get_subcat_name(category, subcat):
    subcat_name = subcat
    if 'World Quests' == category:
        subcat_name = subcat.split('_', 1)[1].replace("_", ' ').title()
    elif 'Main Quests' == category:
        subcat_name = subcat.replace('_', ' ', 1).replace('_', '.').title()
    elif 'Personal Quests' == category:
        subcat_name = subcat.replace('_', ' ').title()
    return subcat_name

def build_category_list(args, titles_map, category_template, quest_map, category, quests):
    subcat_names = {}
    quests_by_subcat = {}

    for quest in quests:
        subcat = quest['title_subcategory']
        if subcat not in quests_by_subcat:
            quests_by_subcat[subcat] = []
        quests_by_subcat[subcat].append(quest)

        if subcat not in subcat_names:
            subcat_name = _get_subcat_name(category, subcat)
            subcat_names[subcat] = (subcat, subcat_name)

    
    for subcat in quests_by_subcat:
        subcat_name = _get_subcat_name(category, subcat)

        quests_ = []
        for quest in quests_by_subcat[subcat]:
            quest_id = quest['quest_id']
            en_name = quest['name']
            
            jp_name = ''
            if quest_id in titles_map:
                jp_name = titles_map[quest_id]['jp_name']

            name = f'{en_name}'
            if len(jp_name):
                name = f'{name}<br>{jp_name}'

            res_page = f'<a href="https://github.com/ddon-research/ddon-data/tree/main/client/03040008/quest/q{quest_id:08d}" target="_blank">q{quest_id:08d}</a>'
            info_page = f'<a href="q{quest_id:08d}.html">{name}</a>'

            keys = ['level', 'xp', 'gold', 'rift', 'ap', 'rewards']

            variants = []
            for variant in quest['variants']:
                values = []
                for key in keys:
                    value = variant[key]
                    if key == 'rewards':
                        unlocks = quest['unlocks']['contents']
                        value = _generate_reward_entries(unlocks, value)
                    elif key == 'level' and variant['is_bounty']:
                        value = f'{value}<br>(bounty)'
                    values.append(value)
                variants.append(values)

            quests_.append({
                'quest_res': res_page,
                'quest_info': info_page,
                'name': en_name,
                'variants': variants
            })
        

        content = category_template.render(
            title = f'{category} / {subcat_name}',
            main_category = category,
            sub_category = subcat_name,
            quests = quests_,
            subcats = subcat_names.values()
        )


        subcat_fname = subcat.replace(' ', '_').replace('.', '_')
        output_file = Path(f'{args.output_dir}/{subcat_fname}.html')
        with open(output_file, mode='w', encoding='utf-8') as f:
            f.write(content)
            print(f"... wrote {output_file}")

def build_index(args, index_template, titles_map, quest_map, quest_data):

    content = index_template.render()

    output_file = Path(f'{args.output_dir}/index.html')
    with open(output_file, mode='w', encoding='utf-8') as f:
        f.write(content)
        print(f"... wrote {output_file}")


def build_site(args):
    # Assign to global fot lambda replacement
    parse_npc_ids(args)
    parse_stage_list(args)
    parse_spot_names(args)

    titles_map = parse_titles(args)

    environment = Environment(loader=FileSystemLoader("templates/"))
    
    info_template = environment.get_template("info.html")
    category_template = environment.get_template("category.html")
    index_template = environment.get_template("index.html")

    quest_map = {}
    quests_by_category = {}
    for filepath in Path(args.data_root).iterdir():
        if filepath.name not in category_map:
            continue

        quest_category = category_map[filepath.name]
        if not filepath.is_dir():
            continue

        for subcategory in filepath.iterdir():
            if not subcategory.is_dir():
                continue
            for quest in subcategory.iterdir():
                with open(quest, 'r', encoding='utf-8') as f:
                    quest_data = json.load(f)
                    quest_data['title_category'] = quest_category
                    quest_data['title_subcategory'] = subcategory.name
                    quest_map[quest_data['quest_id']] = quest_data

                    if quest_category not in quests_by_category:
                        quests_by_category[quest_category] = []
                    quests_by_category[quest_category].append(quest_data)
    
    for category in quests_by_category:
        build_category_list(args, titles_map, category_template, quest_map, category, quests_by_category[category])

    for quest_id in quest_map:
        quest_data = quest_map[quest_id]
        build_quest_info(args, titles_map, info_template, quest_map, quest_data)

    build_index(args, index_template, titles_map, quest_map, quest_data)

def parse_npc_ids(args):
    with open(args.npcs, 'r', encoding='utf-8') as f:
        data = json.load(f)

    for name in data:
        npc_id = data[name]
        name = _breakup_camelcase_string(name)
        npc_ids[npc_id] = ''.join([char for char in name if not char.isnumeric()])

def parse_spot_names(args):
    with open(args.spots, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # SPOT_NAME_450,白竜神殿レーゼ,The White Dragon Temple
    i = 0
    for line in lines:
        if i == 0:
            i += 1
            continue

        spot, jp_name, en_name = line.split(',', 2)

        print(spot.rsplit('_', 1))
        spot_id = int(spot.rsplit('_', 1)[1])
        spot_ids[spot_id] = en_name

def parse_stage_list(args):
    with open(args.stages, 'r', encoding='utf-8') as f:
        data = json.load(f)

    for stage_info in data['StageListInfoList']:
        stage_no = stage_info['StageNo']
        stage_nos[stage_no] = stage_info['StageName']['En']

def parse_titles(args):
    with open(args.titles, 'r', encoding='utf-8') as f:
        lines =  f.readlines()

    title_map = {}
    for line in lines:
        quest_id, line = line.split(':', 1)
        en_name, jp_name = line.split('|')

        quest_id = int(quest_id.split('_')[0].strip()[1:])
        en_name = en_name.strip()
        jp_name = jp_name.strip()

        title_map[quest_id] = {'en_name': en_name, 'jp_name': jp_name}

    # Add on off missing information
    title_map[22020000] = {'en_name': 'Furious Charge', 'jp_name': '激昂の突進'}
    title_map[22018051] = {'en_name': 'Flickering Shadow of Flame', 'jp_name': '徘徊する炎の影'}
    title_map[22018052] = {'en_name': 'A Difficult Journey', 'jp_name': '石拾うにも苦難の道程'}
    title_map[22018053] = {'en_name': 'Judge of Truth', 'jp_name': '真偽の判定者'}
    title_map[22018054] = {'en_name': 'Unshakeable Anxiety', 'jp_name': '拭えぬ心労'}
    title_map[22018055] = {'en_name': 'Lost in the Haze', 'jp_name': '行方を眩ます陽炎'}
    title_map[22018056] = {'en_name': 'Time Restriction: Collecting Ash Before the Demons Return', 'jp_name': '【時限採取】鬼の居ぬ間の採灰道'}


    title_map[30210] = {'en_name': 'The Missing Prince', 'jp_name': '消えた王子'}
    title_map[30220] = {'en_name': 'Nedo\'s Trail', 'jp_name':'ネドの足取り'}
    title_map[30230] = {'en_name': 'The Royal Family Mausoleum', 'jp_name':'王家の墓'}
    title_map[30240] = {'en_name': 'The Dreadful Passage', 'jp_name':'恐ろしき道'}
    title_map[30250] = {'en_name': 'The Relics of the First King', 'jp_name':'初代王の遺品'}
    title_map[30260] = {'en_name': 'Hope\'s Bitter End', 'jp_name':'望みの果て'}
    title_map[30270] = {'en_name': 'Those Who Follow the Dragon', 'jp_name':'竜を継ぐ者'}
    title_map[30410] = {'en_name': 'Breakdown of Reason', 'jp_name':'理の崩壊'}
    title_map[30420] = {'en_name': 'Spun Together Hope', 'jp_name':'紡ぎし望み'}
    title_map[30430] = {'en_name': 'The White Dragon\'s Arisen', 'jp_name':'白竜の覚者'}
    title_map[30440] = {'en_name': 'The Fate of All', 'jp_name':'すべての行く末'}

    title_map[60301052] = {
        'jp_name': '緊急！　お菓子が足りない！＜１＞', 
        'en_name': 'Emergency! Not Enough Candy! (1)'
    }
    title_map[60301053] = {
        'jp_name': '事件？　お菓子が足りない！＜２＞',
        'en_name': 'Emergency! Not Enough Candy! (2)'
    }
    title_map[60301056] = {'jp_name': '笑顔振りまくメリークリスマス＜２＞', 'en_name': 'A Merry Christmas Spreading Cheer (2)'}

    title_map[60350000] = {'jp_name': 'ガルドノック砦の異変', 'en_name': 'Strange Happening at Guardknock Fortress'}
    title_map[60350001] = {'jp_name': '神殿を狙うは――', 'en_name': 'Aiming for the Temple'}
    title_map[60350002] = {'jp_name': '次代の竜となる者へ', 'en_name': 'To The One Who Will Become the Next Dragon'}
    title_map[60321002] = {'jp_name': 'ウルテカ山岳　試練：静かな抗戦跡', 'en_name': 'Urteca Mountains Trial: Quiet Battlefield of the Resistance'}
    title_map[60321001] = {'jp_name': 'ウルテカ山岳　試練：痛刻の洞', 'en_name': 'Urteca Mountains Trial: The Scarred Cavern'}
    title_map[60300110] = {'jp_name': '冒険スポットの手引き：ウルテカ山岳1', 'en_name': 'Adventure Spot Guide: Urteca Mountains I'}
    title_map[60321000] = {'jp_name': 'ウルテカ山岳　試練：原種の縄張り', 'en_name': 'Urteca Mountains Trial: Territory of the Ancestors'}
    title_map[60300200] = {'jp_name': '王冠と王笏＜１＞', 'en_name': 'Crown and Scepter I'}
    title_map[60300201] = {'jp_name': '王冠と王笏＜２＞', 'en_name': 'Crown and Scepter II'}
    title_map[60300202] = {'jp_name': '王冠と王笏＜３＞', 'en_name': 'Crown and Scepter III'}
    title_map[60300203] = {'jp_name': '王冠と王笏＜４＞', 'en_name': 'Crown and Scepter IV'}
    title_map[60321003] = {'jp_name': 'ウルテカ山岳　試練：原初の集落', 'en_name': 'Urteca Mountains Trial: Primitive Settlement'}
    title_map[60300111] = {'jp_name': '冒険スポットの手引き：ウルテカ山岳2', 'en_name': 'Adventure Spot Guide: Urteca Mountains II'}
    title_map[60300112] = {'jp_name': '冒険スポットの手引き：ウルテカ山岳3', 'en_name': 'Adventure Spot Guide: Urteca Mountains III'}
    title_map[60321004] = {'jp_name': 'ウルテカ山岳　試練：建設資材集積場', 'en_name': 'Urteca Mountains Trial: Construction Materials Collection Spot'}
    title_map[60300023] = {'jp_name': '英霊眠りし道へ ウルテカ地方', 'en_name': 'To the Heroic Spirit Sleeping Path Urteca District'}
    title_map[60321010] = {'jp_name': 'ウルテカ山岳　試練：闇の滴り', 'en_name': 'Urteca Mountains Trial: A Trickle in the Darkness'}
    title_map[60321011] = {'jp_name': '彼方より堕ち呼ばれし魔道', 'en_name': 'Magick Called to the Deepest Depths'}
    title_map[60300043] = {'jp_name': '王家再興の褒章4', 'en_name': 'Restored Medal of the Royal Family ４'}
    title_map[61000000] = {'jp_name': 'ワイルドハントのご案内', 'en_name': 'Information on Wild Hunt'}
    title_map[61000001] = {'jp_name': '竜の力を帯びた武具＜1＞', 'en_name': 'Arms With the Power of the Dragon I'}
    title_map[61000002] = {'jp_name': '竜の力を帯びた武具＜2＞', 'en_name': 'Arms With the Power of the Dragon II'}
    title_map[61000004] = {'jp_name': '黒呪の迷宮 深淵への案内', 'en_name': 'Information on Bitterblack Maze Abyss'}
    title_map[61000005] = {'jp_name': '途絶えぬ闇', 'en_name': 'Unending Darkness'}
    title_map[60300401] = {'jp_name': '求道の師を求めて ハイセプター', 'en_name': 'Seeking the Master: High Scepter'}
    title_map[60300042] = {'jp_name': '王家再興の褒章3', 'en_name': 'Restored Medal of the Royal Family ３'}
    title_map[60300105] = {'jp_name': '冒険スポットの手引き：フェルヤナ荒原2', 'en_name': 'Adventure Spot Guide: Feryana Wilderness II'}
    title_map[60300041] = {'jp_name': '王家再興の褒章2', 'en_name': 'Restored Medal of the Royal Family ２'}
    title_map[60300002] = {'jp_name': 'カスタムメイド工房1 探求者の帰還', 'en_name': 'Custom-Made Workshop 1: Searcher\'s Return'}
    title_map[60300003] = {'jp_name': 'カスタムメイド工房2 リミット解除', 'en_name': 'Custom-Made Workshop 2: Limit Break'}
    title_map[60300004] = {'jp_name': 'カスタムメイド工房3 武具極限合成', 'en_name': 'Custom-Made Workshop 3: Ultimate Arms Synthesis'}
    title_map[60300101] = {'jp_name': '冒険スポットの手引き：ラスニテ山麓2', 'en_name': 'Adventure Spot Guide: Rathnite Foothills II'}
    title_map[60200007] = {'jp_name': '辺境に眠りし宝2', 'en_name': 'The Treasure Lying in the Frontier 2'}
    title_map[60200004] = {'jp_name': '至高の耀き', 'en_name': 'Supreme Radiance'}

    return title_map

def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('-o', '--output_dir', default='build', help='Controls the output directory')
    parser.add_argument('-t', '--titles', default='resources/titles.txt', help='Path to the file containing quest titles')
    parser.add_argument('-n', '--npcs', default='resources/npc_id.json', help='Path to npc_id.json')
    parser.add_argument('-p', '--spots', default='resources/spot_name.csv', help='Path to spot_name.csv')
    parser.add_argument('-s', '--stages', default='resources/stage_list.slt.json', help='Path to stage_list.slt.json')
    parser.add_argument('data_root', help='Path to quest data')

    args = parser.parse_args()

    paths = [args.data_root]
    for p in paths:
        path = Path(p)
        if not path.exists(): 
            print(f'The path "{path}" is invalid. Exiting.')
            return None
        if not path.is_dir():
            print(f'The path "{path}" is not a directory. Exiting.')
            return None

    paths = [args.titles, args.npcs, args.stages, args.spots]
    for p in paths:
        if not Path(p).exists():
            print('The path "{p}" is invalid. Exiting.')
            return None

    # create the output dir
    Path(args.output_dir).mkdir(parents=True, exist_ok=True)

    return args

def copy_deps(args):
    Path(f'{args.output_dir}/css').mkdir(parents=True, exist_ok=True)
    shutil.copy2("css/styles.css", f'{args.output_dir}/css/styles.css')
    shutil.copytree("images", f'{args.output_dir}/images', dirs_exist_ok=True)


def main():
    args = parse_args()
    if args is None:
        return
    copy_deps(args)
    build_site(args)

if __name__ == '__main__':
    main()
