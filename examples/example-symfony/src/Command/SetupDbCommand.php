<?php

namespace App\Command;

use App\Entity\Product;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'app:setup-db', description: 'Create SQLite schema and seed sample products')]
final class SetupDbCommand extends Command
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $metadata = $this->em->getMetadataFactory()->getAllMetadata();
        $tool = new SchemaTool($this->em);
        $tool->dropSchema($metadata);
        $tool->createSchema($metadata);

        $samples = [
            ['Widget Pro', 1999, 42],
            ['Gadget Lite', 999, 120],
            ['Spanner 10mm', 499, 300],
            ['Bolt M8', 99, 5000],
            ['Hammer Classic', 1499, 78],
            ['Screwdriver Set', 2999, 25],
            ['Wrench Metric', 1799, 64],
            ['Drill Bit 5mm', 399, 800],
            ['Tape Measure 5m', 699, 150],
            ['Level Bubble', 899, 90],
        ];
        foreach ($samples as [$name, $price, $stock]) {
            $this->em->persist(new Product($name, $price, $stock));
        }
        $this->em->flush();

        $output->writeln(sprintf('<info>Schema created. Seeded %d products.</info>', count($samples)));

        return Command::SUCCESS;
    }
}
