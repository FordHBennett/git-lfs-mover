const { spawnSync } = require("child_process");
const fs = require('fs-extra');
const glob = require('glob');
const axios = require('axios');
const config = require('./config');

async function main() {
    const repoPath = `${config.source.repo}`;
    const issuesFiles = glob.sync(`${config.source.repo}/issues/issue-+([0-9]).json`);
    const issues = await Promise.all(issuesFiles.map(async (file) => JSON.parse(await fs.readFile(file))));

    for (issue of issues) {
        const body = issue.body;
        if(body === null)
        {
            continue;
        }
        else if(body.includes("![image](")){
            const image = body.split("![image](")[1].split(")")[0];
            try {
                // Download the image using axios
                const response = await axios.get(image, { responseType: 'arraybuffer' });

                // Save the image to a file locally
                const filename = "issue_number_" + issue.number + ".png";
                await fs.writeFile(`images/${filename}`, Buffer.from(response.data));

                console.log(`Image downloaded: ${filename}`);
            } catch (error) {
                console.error(`Error downloading image: ${image}`, error);
            }

        }
    }
}
main();