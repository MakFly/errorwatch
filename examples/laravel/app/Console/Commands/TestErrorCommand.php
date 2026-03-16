<?php

declare(strict_types=1);

namespace App\Console\Commands;

use ErrorWatch\Laravel\Facades\ErrorWatch;
use Illuminate\Console\Command;
use RuntimeException;

class TestErrorCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'errorwatch:test
                            {--message : Send a test message instead of throwing an exception}
                            {--breadcrumb : Add breadcrumbs before throwing}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Test ErrorWatch SDK integration by capturing an exception or sending a message';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('ErrorWatch SDK test');
        $this->line('  Endpoint : ' . (config('errorwatch.endpoint') ?? '(not set)'));
        $this->line('  API Key  : ' . $this->maskApiKey(config('errorwatch.api_key')));
        $this->line('  Enabled  : ' . (ErrorWatch::isEnabled() ? 'yes' : 'no'));
        $this->newLine();

        if ($this->option('message')) {
            return $this->sendTestMessage();
        }

        if ($this->option('breadcrumb')) {
            return $this->throwWithBreadcrumbs();
        }

        return $this->throwTestException();
    }

    /**
     * Send a test message via the ErrorWatch facade.
     */
    private function sendTestMessage(): int
    {
        $this->info('Sending test message...');

        $eventId = ErrorWatch::captureMessage(
            message: 'Test message from errorwatch:test Artisan command',
            level: 'info',
            context: [
                'source' => 'artisan:errorwatch:test',
                'timestamp' => now()->toIso8601String(),
            ]
        );

        if ($eventId) {
            $this->info("Message sent. Event ID: {$eventId}");
            $this->line('Check your ErrorWatch dashboard to confirm reception.');
        } else {
            $this->warn('Message was not sent (SDK disabled or endpoint not configured).');
        }

        return self::SUCCESS;
    }

    /**
     * Add breadcrumbs then throw a test exception.
     */
    private function throwWithBreadcrumbs(): never
    {
        $this->info('Adding breadcrumbs and throwing exception...');

        ErrorWatch::addBreadcrumb(
            message: 'Artisan command started',
            type: 'console',
            data: ['command' => 'errorwatch:test', 'step' => 1]
        );

        ErrorWatch::addBreadcrumb(
            message: 'Breadcrumbs enabled, about to throw',
            type: 'default',
            data: ['step' => 2]
        );

        throw new RuntimeException(
            'Test exception with breadcrumbs from errorwatch:test command. ' .
            'Check the "breadcrumbs" field in your ErrorWatch dashboard.'
        );
    }

    /**
     * Throw a plain test exception to verify exception capture.
     */
    private function throwTestException(): never
    {
        $this->info('Throwing test exception...');

        throw new RuntimeException(
            'Test exception from errorwatch:test Artisan command. ' .
            'You should see this in your ErrorWatch dashboard.'
        );
    }

    /**
     * Mask an API key for safe output (show first 8 chars only).
     */
    private function maskApiKey(?string $key): string
    {
        if ($key === null || $key === '') {
            return '(not set)';
        }

        return substr($key, 0, 8) . str_repeat('*', max(0, strlen($key) - 8));
    }
}
