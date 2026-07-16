import { Logger } from '@aws-lambda-powertools/logger';
import { Context, ScheduledEvent } from 'aws-lambda';
import { getCurrentDateInSaoPaulo, isLastDayOfMonth } from './date-utils';
import { runMonthlyJob } from './jobs/monthly-job';
import { runWeeklyJob } from './jobs/weekly-job';

const logger = new Logger({ serviceName: 'scheduled-jobs-handler' });

interface SchedulePayload {
  jobType: 'monthly' | 'weekly';
}

export const handler = async (event: SchedulePayload, context: Context): Promise<void> => {
  logger.info('Scheduled job triggered', {
    jobType: event.jobType,
    eventId: context.awsRequestId,
    time: new Date().toISOString(),
  });

  const now = getCurrentDateInSaoPaulo();
  const isLastDay = isLastDayOfMonth(now);

  logger.info('Date check', {
    date: now.toISOString(),
    isLastDayOfMonth: isLastDay,
  });

  try {
    switch (event.jobType) {
      case 'monthly':
        logger.info('Executing monthly job');
        await runMonthlyJob();
        break;

      case 'weekly':
        if (isLastDay) {
          logger.info(
            'Skipping weekly job - today is the last day of the month',
            {
              reason: 'collision_avoidance',
              date: now.toISOString(),
            }
          );
          return;
        }
        logger.info('Executing weekly job');
        await runWeeklyJob();
        break;

      default:
        logger.error('Invalid job type received', {
          jobType: event.jobType,
        });
        throw new Error(`Invalid jobType: ${event.jobType}`);
    }

    logger.info('Job completed successfully', {
      jobType: event.jobType,
    });
  } catch (error) {
    logger.error('Job execution failed', {
      jobType: event.jobType,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
