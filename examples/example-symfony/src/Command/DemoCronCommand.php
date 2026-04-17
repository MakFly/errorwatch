<?php

namespace App\Command;

use ErrorWatch\Symfony\Cron\CronCheckinClient;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'app:cron:demo', description: 'Simulate a cron job and send start/finish check-ins to ErrorWatch')]
final class DemoCronCommand extends Command
{
    public function __construct(private readonly CronCheckinClient $cron)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $slug = 'demo-cron';
        $start = microtime(true);
        $checkinId = $this->cron->start($slug, ['host' => gethostname()]);

        // Simulated work — 10% chance of failure for realistic dashboards.
        usleep(random_int(100_000, 400_000));
        $exitCode = random_int(1, 10) === 1 ? Command::FAILURE : Command::SUCCESS;

        $duration = (int) ((microtime(true) - $start) * 1000);
        $this->cron->finish($slug, $checkinId ?? '', $exitCode, $duration);

        $output->writeln(sprintf('<info>cron %s finished in %dms (exit=%d)</info>', $slug, $duration, $exitCode));

        return $exitCode;
    }
}
