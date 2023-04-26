#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_REF_LEN 2048
#define MAX_BRANCHES 2048

struct Branch {
        char hash[MAX_REF_LEN];
        char head_ref[MAX_REF_LEN];
        char commit_count[MAX_REF_LEN];
};

int compare_branches(const void *a, const void *b) {
    const struct Branch *branch1 = *(struct Branch **)a;
    const struct Branch *branch2 = *(struct Branch **)b;
    return atoi(branch1->commit_count) - atoi(branch2->commit_count);
}

struct Branch *branches[MAX_BRANCHES];

int main(int argc, char* argv[]) {
    FILE* fp;
    char line[MAX_REF_LEN];
    int num_branches = 0;

    fp = fopen("refs-pack", "r");
    if (fp == NULL) {
        perror("Error: Could not open packed-refs file");
        exit(EXIT_FAILURE);
    }

    while (fgets(line, sizeof(line), fp) != NULL && num_branches < MAX_BRANCHES) {
        if (line[0] == '#' || line[0] == '^') {
            continue;
        }
        char *hash = strtok(line, " \t");
        char *ref = strtok(NULL, " \t");
        if (strncmp(ref, "refs/heads/", 12) != 0) {
            continue;
        }

        struct Branch *b = malloc(sizeof(struct Branch));
        strcpy(b->hash, hash);
        strcpy(b->head_ref, ref + 11);

        char command[MAX_REF_LEN];
        snprintf(command, sizeof(command), "git rev-list --count %s", hash);
        FILE *cmd = popen(command, "r");
        fgets(b->commit_count, sizeof(b->commit_count), cmd);
        pclose(cmd);

        branches[num_branches++] = b;
    }
    fclose(fp);

    qsort(branches, num_branches, sizeof(struct Branch *), compare_branches);

    FILE *hash_file = fopen("hashes.txt", "w");
    FILE *head_ref_file = fopen("refs.txt", "w");

    for (int i = 0; i < num_branches; i++) {
        fprintf(hash_file, "%s", branches[i]->hash);
        fprintf(head_ref_file, "%s", branches[i]->head_ref);
    }

    fclose(hash_file);
    fclose(head_ref_file);


    return 0;
}
