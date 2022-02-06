#!/bin/bash

BASES=( "device_referential" \  )
for BD in ${BASES[@]} 
 do
 echo $BD
node replication.js -d gar-rec --db ${BD} -t gar -o ${BD}  #-s gar-prd

  sleep 1

 done
