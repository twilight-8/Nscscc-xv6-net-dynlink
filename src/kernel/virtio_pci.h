struct virtio_pci_common_cfg {
  uint32 device_feature_select;
  uint32 device_feature;
  uint32 driver_feature_select;
  uint32 driver_feature;
  uint16 msix_config;
  uint16 num_queues;
  uint8 device_status;
  uint8 config_generation;
  uint16 queue_select;
  uint16 queue_size;
  uint16 queue_msix_vector;
  uint16 queue_enable;
  uint16 queue_notify_off;
  uint64 queue_desc;
  uint64 queue_driver;
  uint64 queue_device;
};

struct virtio_pci_device {
  volatile struct virtio_pci_common_cfg *common;
  volatile uint8 *isr;
  volatile uint16 *notify;
  uint32 notify_multiplier;
};

int virtio_pci_probe(uint16, struct virtio_pci_device *, int);
