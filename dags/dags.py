import random
import time

from airflow.sdk import chain, dag, task

DAG_COUNT = 12
FAILURE_RATE = 0.4

LOG_LINES = [
    "Initializing processing pipeline...",
    "Loading configuration from environment.",
    "Connecting to upstream data source.",
    "Validating schema integrity.",
    "Fetching batch records from queue.",
    "Applying transformation rules.",
    "Running deduplication pass.",
    "Checkpoint reached: 25% complete.",
    "Enriching records with metadata.",
    "Checkpoint reached: 50% complete.",
    "Writing intermediate results to staging.",
    "Checkpoint reached: 75% complete.",
    "Flushing output buffer.",
    "Verifying record counts.",
    "Finalizing processing run.",
    "Committing transaction.",
    "Cleanup complete.",
]


def create_dag(dag_id):

    @dag(dag_id=dag_id)
    def generated_dag():

        @task()
        def wait():
            time.sleep(10)

        @task()
        def process():
            duration = random.uniform(3, 6)
            end_time = time.time() + duration
            log_pool = LOG_LINES.copy()
            random.shuffle(log_pool)
            log_index = 0

            while time.time() < end_time:
                if log_index < len(log_pool):
                    print(log_pool[log_index])
                    log_index += 1
                else:
                    log_pool = LOG_LINES.copy()
                    random.shuffle(log_pool)
                    log_index = 0
                time.sleep(random.uniform(0.3, 0.8))

            if random.random() < FAILURE_RATE:
                raise RuntimeError("Process task failed.")

        chain(wait(), process())

    return generated_dag()


for i in range(DAG_COUNT):
    create_dag(f"dag_{i + 1:02d}")
