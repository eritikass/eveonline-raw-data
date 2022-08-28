const fs = require('fs');
const lodash = require('lodash');
const glob = require("glob")
const axios = require('axios').default;

// https://esi.evetech.net/ui/

async function readJsonFile(path) {
    const c = await fs.promises.readFile(path);
    return JSON.parse(c);
}

async function load_type(data_type, checkKey) {
    const data = await axios.get(`https://esi.evetech.net/latest/universe/${data_type}/?datasource=tranquility`);
    const ids = lodash.reverse(data.data);


    console.log('ids', ids, ids.length);

    return load_by_ids(data_type, ids, checkKey);
}

async function load_by_ids(data_type, ids, checkKey) {
    const cc = lodash.chunk(ids, 5);
    let _done = 0;
    for (const _i in cc) {
        const subIds = cc[_i]
        console.log('subIds', subIds);

        await Promise.all(lodash.map(subIds, async function(id) {
            console.log(` - id:${data_type}(${subIds.length})`, id);

            const data_file_path = `${data_type}/${id}.json`;

            if (fs.existsSync(data_file_path)) {
                console.log(`loaded:${data_type} [${++_done}/${ids.length}]`, id);
                return;
            }
    
            const url = `https://esi.evetech.net/latest/universe/${data_type}/${id}/?datasource=tranquility&language=en`;
            console.log('!url', url);
    
            let eData = null;
            try {
                const data2 = await axios.get(url);
                eData = data2.data;
            } catch (e) {
                console.log('error-load-again', url, e);
                await new Promise(r => setTimeout(r, 3000));

                const data3 = await axios.get(url);
                eData = data3.data;
            }

            console.log(`eData:${data_type} [${++_done}/${ids.length}]`, checkKey, eData);
            if (!eData || eData[checkKey] !== id) {
                throw new Error('DATA_ERROR');
                process.exit(1);
            }
            
            await fs.promises.writeFile(data_file_path,  JSON.stringify(eData, ' ', 4));
        }));
    }

    console.log(`-------- all done --------`, data_type, ids.length);
}

async function load_stargates() {
    const res = glob.sync('systems/*.json');

    let stargate_ids = [];
    for (const _i in res) { 
        const system_data_file = res[_i];
        const system = await readJsonFile(system_data_file);

        stargate_ids.push(...system.stargates || []);
    }

    console.log('stargate_ids', stargate_ids, stargate_ids.length);

    return load_by_ids('stargates', lodash.reverse(stargate_ids), 'stargate_id');

}

async function aggr() {
    const systems = {};
    const system_id_to_name = {};

    const systemDataFiles = glob.sync('systems/*.json');
    for (const sysIndex in systemDataFiles) { 
        const system_data_file = systemDataFiles[sysIndex];
        const system = await readJsonFile(system_data_file);

        const constellation = await readJsonFile(`constellations/${system.constellation_id}.json`);
        const region = await readJsonFile(`regions/${constellation.region_id}.json`);

        system_id_to_name[String(system.system_id)] = system.name;

        systems[system.name] = {
            id: system.system_id,
            name: system.name,
            sec_class: system.security_class,
            sec_status: system.security_status,
            constellation_id: constellation.id,
            constellation: constellation.name,
            region_id: region.id,
            region: region.name,
            connections: [],
        }
    }

    const stargatesDataFiles = glob.sync('stargates/*.json');
    for (const gateIndex in stargatesDataFiles) { 
        const gate_data_file = stargatesDataFiles[gateIndex];
        const gate = await readJsonFile(gate_data_file);

        const sys1 = system_id_to_name[String(gate.system_id)];
        const sys2 = system_id_to_name[String(gate.destination.system_id)];

        systems[sys1].connections.push(sys2);
        systems[sys2].connections.push(sys1);

        // console.log('gate', gate);
        // break;
    }

    for (const sysName in systems) { 
        systems[sysName].connections = lodash.uniq(systems[sysName].connections);
    }

    await fs.promises.writeFile('systems.json',  JSON.stringify(systems, ' ', 4));

    console.log('aggr:done', Object.values(systems).length);
}


async function main() {
    await load_type('regions', 'region_id');
    await load_type('systems', 'system_id');
    await load_type('constellations', 'constellation_id');
    await load_stargates();
    await aggr();
}

main();
