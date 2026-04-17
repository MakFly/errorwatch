<?php

namespace App\MessageHandler;

use App\Message\SendNotificationMessage;
use Psr\Log\LoggerInterface;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;

/**
 * Simulates a real notification dispatch (SMTP, push, SMS…) — spends some
 * time, hits the cache, logs a structured line so each consume produces a
 * realistic transaction with child spans.
 */
#[AsMessageHandler]
final class SendNotificationHandler
{
    public function __construct(
        private readonly LoggerInterface $logger,
        private readonly CacheInterface $cache,
    ) {
    }

    public function __invoke(SendNotificationMessage $message): void
    {
        $this->logger->info('processing notification', [
            'to' => $message->userEmail,
            'subject' => $message->subject,
        ]);

        // Touch the cache so we get a cache span inside the queue.process transaction
        $this->cache->get('notification.template.' . md5($message->subject), function (ItemInterface $item) use ($message) {
            $item->expiresAfter(300);

            return ['subject' => $message->subject, 'rendered_at' => microtime(true)];
        });

        // Simulate I/O (SMTP roundtrip, etc.)
        usleep((int) (150 * 1000));

        $this->logger->info('notification sent', ['to' => $message->userEmail]);
    }
}
