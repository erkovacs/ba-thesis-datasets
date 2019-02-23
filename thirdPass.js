const fs = require('fs');

const INPUT_PATH = './data/attractions-processed-cleaned.csv';
const INPUT_PATH_DESCS = './data/descriptions.csv';
const OUTPUT_PATH = './data/attractions-processed-final.csv';

fs.readFile(INPUT_PATH, 'utf-8', (err, data) => {
    if(err) throw err;
    const csv = fs.createWriteStream(OUTPUT_PATH, {
        flags: 'a' // 'a' means appending (old data will be preserved)
    });
    const descriptions = fs.readFileSync(INPUT_PATH_DESCS, "utf-8").split(/\n/gi);
    console.log(descriptions);
    const rows = data.split(/\n/gi);
    for(let i = 0 ; i < rows.length; i++){
        if(i === 0){
            csv.write("NR CRT," + rows[i] + "\n");
            continue;
        }
        const fields = rows[i].split(/","/gi);
        if((typeof fields[3] !== "string" || fields[3] === "N/A" || fields[3].trim() === "") && typeof descriptions[i+1] != "undefined"){
            console.log(typeof descriptions[i+1]);
            fields[3] = descriptions[i+1].replace(/\n\r|"/gi, '');
        }
        csv.write(i + "," + fields.join('","')+"\n");
    }
    csv.end();
}); 
