const fs = require('fs');
const lodash = require('lodash');
const axios = require('axios').default;


// https://esi.evetech.net/ui/


async function load() {
    // load systems
    const data = await axios.get('https://esi.evetech.net/latest/universe/systems/?datasource=tranquility');
    const systemIds = lodash.reverse(data.data);


    console.log('systemIds', systemIds, systemIds.length);

    const cc = lodash.chunk(systemIds, 5);
    for (const _i in cc) {
        const subIds = cc[_i]
        console.log('subIds', subIds);

        await Promise.all(lodash.map(subIds, async function(systemId) {
            console.log(` - system-id(${subIds.length})`, systemId);

            const data_file_path = `systems/${systemId}.json`;

            if (fs.existsSync(data_file_path)) {
                console.log('loaded', systemId);
                return;
            }
    
            const url = `https://esi.evetech.net/latest/universe/systems/${systemId}/?datasource=tranquility&language=en`;
            console.log('!url', url);
    
            let system = null;
            try {
                const data2 = await axios.get(url);
                system = data2.data;
            } catch (e) {
                console.log('error-load-again', url, e);
                await new Promise(r => setTimeout(r, 3000));

                const data3 = await axios.get(url);
                system = data3.data;
            }

            console.log('system', system);
            if (!system || system.system_id !== systemId) {
                throw new Error('DATA_ERROR');
                process.exit(1);
            }
            
            await fs.writeFile(data_file_path,  JSON.stringify(system, ' ', 4), err => {
                if (err) {
                    console.error('WRITE_FILE', url, err);
                }
            });
        }));
            




    }
}


load();

